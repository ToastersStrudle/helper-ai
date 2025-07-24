document.addEventListener('DOMContentLoaded', function() {
    const questionInput = document.getElementById('questionInput');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const resultsDiv = document.getElementById('results');
    const resultsContent = document.getElementById('resultsContent');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const includeImagesCheckbox = document.getElementById('includeImages');
    const autoHighlightCheckbox = document.getElementById('autoHighlight');

    // Load saved settings and check for pending questions
    chrome.storage.sync.get(['includeImages', 'autoHighlight'], function(result) {
        includeImagesCheckbox.checked = result.includeImages !== false;
        autoHighlightCheckbox.checked = result.autoHighlight !== false;
    });

    // Check for pending questions from content script
    chrome.storage.local.get(['pendingQuestion', 'pendingQuestionTimestamp'], function(result) {
        if (result.pendingQuestion && result.pendingQuestionTimestamp) {
            // Only use if timestamp is recent (within 30 seconds)
            const now = Date.now();
            if (now - result.pendingQuestionTimestamp < 30000) {
                questionInput.value = result.pendingQuestion;
                analyzeBtn.disabled = false;
                
                // Clear the pending question
                chrome.storage.local.remove(['pendingQuestion', 'pendingQuestionTimestamp']);
            }
        }
    });

    // Save settings when changed
    includeImagesCheckbox.addEventListener('change', function() {
        chrome.storage.sync.set({includeImages: this.checked});
    });

    autoHighlightCheckbox.addEventListener('change', function() {
        chrome.storage.sync.set({autoHighlight: this.checked});
    });

    // Enable/disable analyze button based on input
    questionInput.addEventListener('input', function() {
        analyzeBtn.disabled = this.value.trim() === '';
    });

    // Clear functionality
    clearBtn.addEventListener('click', function() {
        questionInput.value = '';
        hideAllSections();
        analyzeBtn.disabled = true;
    });

    // Analyze functionality
    analyzeBtn.addEventListener('click', async function() {
        const question = questionInput.value.trim();
        if (!question) return;

        showLoading();
        
        try {
            // Get current tab
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            // Extract page content
            const [result] = await chrome.scripting.executeScript({
                target: {tabId: tab.id},
                function: extractPageContent,
                args: [includeImagesCheckbox.checked]
            });

            const pageContent = result.result;
            
            if (!pageContent || pageContent.text.length < 10) {
                throw new Error('Unable to extract sufficient content from this page');
            }

            // Analyze content and answer question
            const answer = await analyzeContent(pageContent, question);
            showResults(answer);

            // Highlight relevant content if enabled
            if (autoHighlightCheckbox.checked) {
                chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    function: highlightRelevantContent,
                    args: [answer, question]
                });
            }

        } catch (error) {
            console.error('Analysis error:', error);
            showError(error.message || 'An error occurred while analyzing the page');
        }
    });

    function showLoading() {
        hideAllSections();
        loadingDiv.style.display = 'block';
        analyzeBtn.disabled = true;
    }

    function showResults(answer) {
        hideAllSections();
        resultsContent.innerHTML = formatAnswer(answer);
        resultsDiv.style.display = 'block';
        analyzeBtn.disabled = false;
    }

    function showError(message) {
        hideAllSections();
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        analyzeBtn.disabled = false;
    }

    function hideAllSections() {
        resultsDiv.style.display = 'none';
        loadingDiv.style.display = 'none';
        errorDiv.style.display = 'none';
    }

    function formatAnswer(answer) {
        // Convert markdown-like formatting to HTML
        return answer
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>')
            .replace(/^/, '<p>')
            .replace(/$/, '</p>');
    }

    // Initialize
    analyzeBtn.disabled = true;
});

// Function to be injected into the page
function extractPageContent(includeImages) {
    const content = {
        title: document.title,
        url: window.location.href,
        text: '',
        images: [],
        links: [],
        metadata: {}
    };

    // Extract text content
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                
                const tagName = parent.tagName.toLowerCase();
                const style = window.getComputedStyle(parent);
                
                // Skip invisible elements
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }
                
                // Skip script and style elements
                if (['script', 'style', 'noscript'].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text.length > 0) {
            textNodes.push(text);
        }
    }
    
    content.text = textNodes.join(' ').replace(/\s+/g, ' ').trim();

    // Extract images if requested
    if (includeImages) {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (img.alt || img.title) {
                content.images.push({
                    src: img.src,
                    alt: img.alt || '',
                    title: img.title || ''
                });
            }
        });
    }

    // Extract important links
    const links = document.querySelectorAll('a[href]');
    const importantLinks = Array.from(links)
        .filter(link => link.textContent.trim().length > 0)
        .slice(0, 10) // Limit to first 10 links
        .map(link => ({
            text: link.textContent.trim(),
            href: link.href
        }));
    
    content.links = importantLinks;

    // Extract metadata
    const metaTags = document.querySelectorAll('meta[name], meta[property]');
    metaTags.forEach(meta => {
        const name = meta.getAttribute('name') || meta.getAttribute('property');
        const content_attr = meta.getAttribute('content');
        if (name && content_attr) {
            content.metadata[name] = content_attr;
        }
    });

    return content;
}

// Function to highlight relevant content
function highlightRelevantContent(answer, question) {
    // Remove existing highlights
    const existingHighlights = document.querySelectorAll('.homework-helper-highlight');
    existingHighlights.forEach(el => {
        const parent = el.parentNode;
        parent.replaceChild(document.createTextNode(el.textContent), el);
        parent.normalize();
    });

    // Extract key terms from the answer
    const keyTerms = extractKeyTerms(answer + ' ' + question);
    
    if (keyTerms.length === 0) return;

    // Create a regex pattern for all key terms
    const pattern = new RegExp('\\b(' + keyTerms.map(term => 
        term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('|') + ')\\b', 'gi');

    // Highlight matching text
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.trim().length > 0) {
            textNodes.push(node);
        }
    }

    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        if (pattern.test(text)) {
            const highlightedHTML = text.replace(pattern, 
                '<span class="homework-helper-highlight" style="background-color: yellow; font-weight: bold;">$1</span>'
            );
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = highlightedHTML;
            
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            
            textNode.parentNode.replaceChild(fragment, textNode);
        }
    });
}

function extractKeyTerms(text) {
    // Simple key term extraction
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'would', 'there', 'could', 'other', 'more', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'also', 'your', 'work', 'life', 'only', 'can', 'still', 'should', 'after', 'being', 'now', 'made', 'before', 'here', 'through', 'when', 'where', 'much', 'some', 'these', 'many', 'then', 'them', 'well', 'were'].includes(word));

    // Return unique terms, sorted by frequency
    const frequency = {};
    words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.keys(frequency)
        .sort((a, b) => frequency[b] - frequency[a])
        .slice(0, 10);
}

async function analyzeContent(pageContent, question) {
    // This is a simplified AI analysis function
    // In a real implementation, you would connect to an AI service like OpenAI, Gemini, etc.
    
    const prompt = `Based on the following web page content, please answer this question: "${question}"

Page Title: ${pageContent.title}
Page URL: ${pageContent.url}

Content: ${pageContent.text.substring(0, 4000)}${pageContent.text.length > 4000 ? '...' : ''}

${pageContent.images.length > 0 ? `Images found: ${pageContent.images.map(img => img.alt || img.title).filter(Boolean).join(', ')}` : ''}

Please provide a clear, educational answer that helps with homework understanding. Focus on explaining concepts rather than just giving direct answers.`;

    try {
        // For demonstration, return a helpful response
        // In production, you would make an API call to an AI service
        return generateHelpfulResponse(pageContent, question);
    } catch (error) {
        throw new Error('Unable to analyze content: ' + error.message);
    }
}

function generateHelpfulResponse(pageContent, question) {
    const content = pageContent.text.toLowerCase();
    const questionLower = question.toLowerCase();
    
    // Simple keyword matching and response generation
    let response = "Based on the page content, here's what I found:\n\n";
    
    // Check if it's a math problem
    if (questionLower.includes('math') || questionLower.includes('equation') || questionLower.includes('solve') || /\d+[\+\-\*\/]\d+/.test(content)) {
        response += "**Mathematical Content Detected:**\n";
        response += "This page appears to contain mathematical content. Look for formulas, equations, or numerical examples that relate to your question.\n\n";
    }
    
    // Check if it's a science topic
    if (questionLower.includes('science') || questionLower.includes('physics') || questionLower.includes('chemistry') || questionLower.includes('biology')) {
        response += "**Scientific Content:**\n";
        response += "This appears to be science-related content. Pay attention to key concepts, definitions, and examples provided.\n\n";
    }
    
    // Check if it's history
    if (questionLower.includes('history') || questionLower.includes('historical') || /\d{4}/.test(content)) {
        response += "**Historical Information:**\n";
        response += "Look for dates, events, and key figures mentioned in the content.\n\n";
    }
    
    // Extract key information
    const sentences = pageContent.text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const relevantSentences = sentences.filter(sentence => {
        const words = questionLower.split(/\s+/);
        return words.some(word => word.length > 3 && sentence.toLowerCase().includes(word));
    });
    
    if (relevantSentences.length > 0) {
        response += "**Relevant Information Found:**\n";
        response += relevantSentences.slice(0, 3).map(s => "• " + s.trim()).join("\n") + "\n\n";
    }
    
    // General advice
    response += "**Study Tips:**\n";
    response += "• Read through the highlighted sections carefully\n";
    response += "• Take notes on key concepts\n";
    response += "• Look for examples that illustrate the main points\n";
    response += "• Consider how this information answers your specific question\n\n";
    
    response += "*For more detailed analysis, consider using dedicated AI tutoring services or consulting your textbook.*";
    
    return response;
}