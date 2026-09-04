// Lightweight client-side chatbot with defensive checks and ARIA-friendly updates
document.addEventListener('DOMContentLoaded', function () {
    try {
        const sendButton = document.getElementById('chatbotSend');
        const inputField = document.getElementById('chatbotInput');
        const messages = document.getElementById('chatbotMessages');

        // If any of the required elements are missing, do nothing (prevents runtime errors)
        if (!sendButton || !inputField || !messages) {
            // eslint-disable-next-line no-console
            console.warn('Chatbot: required DOM elements missing — chatbot disabled.');
            return;
        }

        function addMessage(text, isUser = false) {
            try {
                const message = document.createElement('div');
                message.className = isUser ? 'chat-message user' : 'chat-message bot';
                message.textContent = text;
                message.setAttribute('role', 'article');
                messages.appendChild(message);
                // Keep latest in view
                messages.scrollTop = messages.scrollHeight;
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Chatbot addMessage error', err);
            }
        }

        function getBotReply(question) {
            const normalized = (question || '').toLowerCase();

            if (normalized.includes('hello') || normalized.includes('hi') || normalized.includes('hey')) {
                return 'Hi! I can help with project questions, submissions, and how to connect with the right people.';
            }

            if (normalized.includes('submit') || normalized.includes('story') || normalized.includes('share')) {
                return 'You can submit your story through the Submit page. It is the best place to share your experience or contribution.';
            }

            if (normalized.includes('contact') || normalized.includes('email') || normalized.includes('human') || normalized.includes('real person')) {
                return 'For direct help, use the links in the Get Involved section or visit the About page to connect with the project and community.';
            }

            if (normalized.includes('who') || normalized.includes('more') || normalized.includes('learn') || normalized.includes('earth info') || normalized.includes('info')) {
                return 'You can learn more on the About page, the Earth Info page, and the gallery for examples and background information.';
            }

            if (normalized.includes('gallery') || normalized.includes('photos') || normalized.includes('images')) {
                return 'The gallery is where people share their contributions and images from around the world.';
            }

            if (normalized.includes('thank') || normalized.includes('thanks')) {
                return 'You are welcome! Let me know if you want help finding the right page or sharing your story.';
            }

            return 'I can help with questions about the project, submissions, gallery content, and how to get in touch with the community. Try asking about submitting, contact info, or learning more.';
        }

        function handleSend() {
            try {
                const question = inputField.value.trim();
                if (!question) {
                    return;
                }

                addMessage(question, true);
                inputField.value = '';

                // Simulate async response
                // Try server-backed AI first; fall back to local canned replies
                (async () => {
                    try {
                        const resp = await fetch('/api/chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: question }),
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            if (data && data.reply) {
                                addMessage(data.reply, false);
                                return;
                            }
                        }
                    } catch (err) {
                        // network or server not running — fall through to canned reply
                    }

                    // fallback
                    const reply = getBotReply(question);
                    addMessage(reply, false);
                })();
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Chatbot handleSend error', err);
            }
        }

        // Attach handlers with safety checks
        sendButton.addEventListener('click', handleSend);
        inputField.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                handleSend();
            }
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Chatbot initialization failed', e);
    }
});
