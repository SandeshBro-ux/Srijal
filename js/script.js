// Function to load Typed.js if not already loaded
function loadTypedJs() {
    if (window.Typed) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/typed.js@2.0.12';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Custom typewriter animation
const texts = [
    'Web Developer 🌐',
    'UI Designer 🎨',
    'Full-Stack Developer ⚡',
    'Hotel Management Student 🏨'
];

let textIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typingDelay = 100;

function typeWriter() {
    const currentText = texts[textIndex];
    const typewriterElement = document.querySelector('.typewriter');
    
    if (!typewriterElement) {
        console.error('Typewriter element not found');
        return;
    }

    if (isDeleting) {
        // Deleting text
        typewriterElement.textContent = currentText.substring(0, charIndex - 1);
        charIndex--;
        typingDelay = 50;
    } else {
        // Typing text
        typewriterElement.textContent = currentText.substring(0, charIndex + 1);
        charIndex++;
        typingDelay = 100;
    }

    // Check if word is complete
    if (!isDeleting && charIndex === currentText.length) {
        // Start deleting after delay
        isDeleting = true;
        typingDelay = 1500; // Wait before deleting
    }

    // Check if word is deleted
    if (isDeleting && charIndex === 0) {
        isDeleting = false;
        textIndex = (textIndex + 1) % texts.length;
        typingDelay = 500; // Wait before typing next word
    }

    setTimeout(typeWriter, typingDelay);
}

// Start the animation when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Starting typewriter animation...');
    typeWriter();
});

// Initialize navigation
function initNavigation() {
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            
            document.querySelectorAll('.nav-button').forEach(btn => {
                btn.classList.remove('flash');
                btn.offsetHeight;
            });
            
            this.classList.add('flash');
            
            setTimeout(() => {
                window.location.href = href;
            }, 800);
        });
        
        button.addEventListener('animationend', function() {
            this.classList.remove('flash');
        });
    });
}

// Function to get API base URL
function getApiBaseUrl() {
    // Use Render URL in production, localhost in development
    return window.location.hostname === 'localhost' 
        ? 'http://localhost:5000'
        : 'https://srijal-portfolio.onrender.com';
}

// Function to validate email
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Function to format time remaining
function formatTimeRemaining(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    return {
        hours: Math.max(0, hours),
        minutes: Math.max(0, minutes),
        seconds: Math.max(0, seconds)
    };
}

// Contact form submission
const contactForm = document.querySelector('#contactForm');
if (contactForm) {
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const formMessage = document.querySelector('#formMessage');
    let timerInterval;

    // Function to update timer display
    function updateTimerDisplay(remainingTime) {
        const countdownElement = document.getElementById('countdown');
        if (!countdownElement) return;

        if (remainingTime <= 0) {
            countdownElement.style.display = 'none';
            submitButton.disabled = false;
            formMessage.textContent = '';
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
            return;
        }

        const { hours, minutes, seconds } = formatTimeRemaining(remainingTime);
        countdownElement.style.display = 'block';
        countdownElement.innerHTML = `
            <div class="countdown-item">
                <span class="countdown-value">${hours}</span>
                <span class="countdown-label">Hours</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value">${minutes}</span>
                <span class="countdown-label">Minutes</span>
            </div>
            <div class="countdown-item">
                <span class="countdown-value">${seconds}</span>
                <span class="countdown-label">Seconds</span>
            </div>
        `;

        // Update every second
        if (!timerInterval) {
            timerInterval = setInterval(() => {
                remainingTime -= 1000;
                if (remainingTime <= 0) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                    checkCooldown(); // Verify with server when timer ends
                } else {
                    updateTimerDisplay(remainingTime);
                }
            }, 1000);
        }
    }

    // Function to check cooldown status
    async function checkCooldown() {
        try {
            const baseUrl = getApiBaseUrl();
            const response = await fetch(`${baseUrl}/api/check-cooldown`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (!data.canSend) {
                submitButton.disabled = true;
                updateTimerDisplay(data.remainingTime);
                formMessage.textContent = 'Please wait before sending another message';
                formMessage.style.color = '#ff4444';
            } else {
                submitButton.disabled = false;
                formMessage.textContent = '';
                const countdownElement = document.getElementById('countdown');
                if (countdownElement) {
                    countdownElement.style.display = 'none';
                }
                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }
            }
        } catch (error) {
            console.error('Error checking cooldown:', error);
            // On error, check again after 5 seconds
            setTimeout(checkCooldown, 5000);
        }
    }

    // Contact form submission
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        
        if (!name || !email || !message) {
            formMessage.textContent = 'Please fill in all fields';
            formMessage.style.color = '#ff4444';
            return;
        }
        
        submitButton.disabled = true;
        formMessage.textContent = 'Sending message...';
        
        try {
            const baseUrl = getApiBaseUrl();
            const response = await fetch(`${baseUrl}/api/send-message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, message })
            });
            
            const data = await response.json();
            
            if (data.success) {
                formMessage.textContent = 'Message sent successfully!';
                formMessage.style.color = '#64ffda';
                contactForm.reset();
                
                // Check cooldown status immediately after successful send
                checkCooldown();
            } else {
                formMessage.textContent = data.error;
                formMessage.style.color = '#ff4444';
                if (data.remainingTime) {
                    updateTimerDisplay(data.remainingTime);
                }
            }
        } catch (error) {
            console.error('Error:', error);
            formMessage.textContent = 'Error sending message. Please try again.';
            formMessage.style.color = '#ff4444';
        } finally {
            submitButton.disabled = false;
        }
    });

    // Check cooldown on page load
    checkCooldown();
    
    // Periodically check cooldown status with server (every 30 seconds)
    setInterval(checkCooldown, 30000);
}

// Move the page refresh code after typed.js initialization
if (window.performance && window.performance.navigation.type === window.performance.navigation.TYPE_RELOAD) {
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
        window.location.href = '/';
    }
}

// Project cards hover effect
const projectCards = document.querySelectorAll('.project-card');
projectCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
    });
});

// Button hover animation
const buttons = document.querySelectorAll('.cta-button, .project-button, .submit-button');
buttons.forEach(button => {
    button.addEventListener('mouseenter', function(e) {
        const x = e.pageX - this.offsetLeft;
        const y = e.pageY - this.offsetTop;
        
        const ripple = document.createElement('span');
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        this.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
});
