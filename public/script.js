const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const sendButton = document.getElementById('send-button');
const loading = document.getElementById('loading');

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Disable input and button while processing
    messageInput.disabled = true;
    sendButton.disabled = true;
    loading.style.display = 'block';

    // Add user message to chat
    addMessage(message, 'user');
    messageInput.value = '';

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'An error occurred');
        }

        if (data.response) {
            addMessage(data.response, 'bot');
        } else {
            throw new Error('No response received');
        }
    } catch (error) {
        console.error('Error:', error);
        addMessage("I'm having trouble right now. Please try asking about JavaScript, Python, HTML, or CSS for some quick examples!", 'error');
    } finally {
        // Re-enable input and button
        messageInput.disabled = false;
        sendButton.disabled = false;
        loading.style.display = 'none';
        messageInput.focus();
    }
}

function addMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    // Format code blocks if present
    const formattedMessage = message.replace(/```([\s\S]*?)```/g, '<pre>$1</pre>');
    messageDiv.innerHTML = formattedMessage;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
} 