from flask import Flask, request, jsonify
from flask_mail import Mail, Message
from flask_cors import CORS
import sys
import os
from pathlib import Path

# Add the server directory to Python path
server_dir = Path(__file__).resolve().parent
if str(server_dir) not in sys.path:
    sys.path.append(str(server_dir))

from database import validate_email, init_db, can_send_message, update_last_message_time, is_valid_email
from datetime import datetime
import time
from dotenv import load_dotenv
import logging
import ssl
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)

CORS(app, resources={r"/api/*": {"origins": os.getenv('CORS_ALLOWED_ORIGINS', '*').split(',')}})

# Configure Flask-Mail
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('EMAIL_USER')
app.config['MAIL_PASSWORD'] = os.getenv('EMAIL_PASS')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('EMAIL_USER')
app.config['MAIL_MAX_EMAILS'] = 5
app.config['MAIL_ASCII_ATTACHMENTS'] = True

# Initialize extensions
mail = Mail(app)

try:
    logger.info("Mail configuration initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize mail configuration: {e}")
    raise

# Security headers
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response

# Rate limiting decorator
def rate_limit(limit=5, window=60):
    def decorator(f):
        # Store last request times per IP
        requests = {}
        
        @wraps(f)
        def wrapped(*args, **kwargs):
            # Get real IP, considering proxies
            ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            if ip:
                ip = ip.split(',')[0].strip()
            
            # Get current time
            now = time.time()
            
            # Initialize request list for this IP
            if ip not in requests:
                requests[ip] = []
            
            # Remove old requests
            requests[ip] = [req_time for req_time in requests[ip] if now - req_time < window]
            
            # Check if rate limit is exceeded
            if len(requests[ip]) >= limit:
                return jsonify({
                    'success': False,
                    'error': 'Too many requests. Please try again later.',
                    'remainingTime': window - (now - requests[ip][0])
                }), 429
            
            # Add current request
            requests[ip].append(now)
            
            return f(*args, **kwargs)
        return wrapped
    return decorator

def send_email_with_retry(msg, max_retries=3):
    """Send email with retry mechanism"""
    for attempt in range(max_retries):
        try:
            mail.send(msg)
            logger.info(f"Email sent successfully to {msg.recipients}")
            return True
        except Exception as e:
            logger.error(f"Attempt {attempt + 1} failed: {str(e)}")
            if attempt == max_retries - 1:
                raise
            time.sleep(1)  # Wait before retrying

# Initialize the database
init_db()

@app.route('/api/check-cooldown', methods=['POST'])
@rate_limit(limit=10, window=60)  # 10 requests per minute
def check_cooldown():
    can_send, remaining_time = can_send_message(request)
    
    return jsonify({
        'canSend': can_send,
        'remainingTime': remaining_time * 1000
    })

@app.route('/api/send-message', methods=['POST'])
@rate_limit(limit=5, window=60)  # 5 requests per minute
def send_message():
    # Validate request body
    if not request.is_json:
        return jsonify({
            'success': False,
            'error': 'Invalid request format'
        }), 400
    
    data = request.get_json()
    required_fields = ['name', 'email', 'message']
    
    if not all(field in data for field in required_fields):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400
    
    # Check message length
    if len(data['message']) > 1000:  # Limit message length
        return jsonify({
            'success': False,
            'error': 'Message too long'
        }), 400
    
    # Validate email format
    if not is_valid_email(data['email']):
        return jsonify({
            'success': False,
            'error': 'Invalid email format'
        }), 400
    
    can_send, remaining_time = can_send_message(request)
    
    if not can_send:
        return jsonify({
            'success': False,
            'error': 'Please wait before sending another message',
            'remainingTime': remaining_time * 1000
        })
    
    try:
        # Create email message
        msg = Message(
            subject=f"New Portfolio Message from {data['name']}",
            recipients=[os.getenv('EMAIL_USER')],
            body=f"""
            New message from your portfolio website:
            
            Name: {data['name']}
            Email: {data['email']}
            
            Message:
            {data['message']}
            
            Sent at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
            """,
            reply_to=data['email']  # Enable direct reply to sender
        )
        
        # Send email with retry
        send_email_with_retry(msg)
        
        # Update the cooldown timer for this user
        update_last_message_time(request)
        
        logger.info(f"Message sent successfully from {data['email']}")
        return jsonify({
            'success': True,
            'message': 'Message sent successfully'
        })
        
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        return jsonify({
            'success': False,
            'error': 'Error sending message. Please try again.'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
