// Background service worker for Homework Helper Chrome Extension

// Install event
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Homework Helper installed');
        
        // Set default settings
        chrome.storage.sync.set({
            includeImages: true,
            autoHighlight: true,
            showFloatingButton: true,
            keyboardShortcuts: true
        });
        
        // Open welcome page
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });
    } else if (details.reason === 'update') {
        console.log('Homework Helper updated');
    }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'openPopup':
            handleOpenPopup(sender.tab);
            break;
        case 'openPopupWithText':
            handleOpenPopupWithText(sender.tab, request.text);
            break;
        case 'analyzeCurrentPage':
            handleAnalyzeCurrentPage(sender.tab, request.question);
            break;
        case 'searchWeb':
            handleWebSearch(request.query, sendResponse);
            return true; // Will respond asynchronously
        case 'saveAnalysisHistory':
            handleSaveAnalysisHistory(request.data);
            break;
        case 'getAnalysisHistory':
            handleGetAnalysisHistory(sendResponse);
            return true; // Will respond asynchronously
    }
});

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'homeworkHelper',
        title: 'Get homework help with this text',
        contexts: ['selection']
    });
    
    chrome.contextMenus.create({
        id: 'analyzeFullPage',
        title: 'Analyze this page for homework help',
        contexts: ['page']
    });
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
    switch (info.menuItemId) {
        case 'homeworkHelper':
            if (info.selectionText) {
                handleTextAnalysis(tab, info.selectionText);
            }
            break;
        case 'analyzeFullPage':
            handleFullPageAnalysis(tab);
            break;
    }
});

// Keyboard command handler
chrome.commands.onCommand.addListener((command) => {
    switch (command) {
        case 'open-homework-helper':
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                handleOpenPopup(tabs[0]);
            });
            break;
        case 'toggle-selection-mode':
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'toggleSelectionMode'});
            });
            break;
        case 'clear-highlights':
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'clearHighlights'});
            });
            break;
    }
});

// Handle opening popup
function handleOpenPopup(tab) {
    // Since Manifest V3 doesn't support background pages with popups,
    // we'll open the popup through action API
    chrome.action.openPopup();
}

// Handle opening popup with pre-filled text
function handleOpenPopupWithText(tab, text) {
    // Store the text temporarily for the popup to retrieve
    chrome.storage.local.set({
        'pendingQuestion': text,
        'pendingQuestionTimestamp': Date.now()
    });
    
    chrome.action.openPopup();
}

// Handle analyzing current page
async function handleAnalyzeCurrentPage(tab, question) {
    try {
        const results = await chrome.scripting.executeScript({
            target: {tabId: tab.id},
            function: extractPageContent,
            args: [true] // includeImages
        });
        
        const pageContent = results[0].result;
        
        // Here you would typically send to an AI service
        // For now, we'll use a simple analysis
        const analysis = analyzeContentLocally(pageContent, question);
        
        // Save to history
        saveAnalysisToHistory({
            question,
            pageTitle: pageContent.title,
            pageUrl: pageContent.url,
            analysis,
            timestamp: Date.now()
        });
        
        return analysis;
    } catch (error) {
        console.error('Error analyzing page:', error);
        throw error;
    }
}

// Handle text analysis
async function handleTextAnalysis(tab, text) {
    try {
        // Store the selected text for analysis
        chrome.storage.local.set({
            'pendingQuestion': `Explain this text: "${text}"`,
            'pendingQuestionTimestamp': Date.now()
        });
        
        chrome.action.openPopup();
    } catch (error) {
        console.error('Error analyzing text:', error);
    }
}

// Handle full page analysis
async function handleFullPageAnalysis(tab) {
    try {
        chrome.storage.local.set({
            'pendingQuestion': 'What are the main concepts explained on this page?',
            'pendingQuestionTimestamp': Date.now()
        });
        
        chrome.action.openPopup();
    } catch (error) {
        console.error('Error analyzing page:', error);
    }
}

// Handle web search (for enhanced AI responses)
async function handleWebSearch(query, sendResponse) {
    try {
        // In a real implementation, you would use a search API
        // For demo purposes, we'll return a mock response
        const searchResults = {
            query: query,
            results: [
                {
                    title: "Educational resource for: " + query,
                    snippet: "This is a mock search result for demonstration purposes.",
                    url: "https://example.com/search"
                }
            ]
        };
        
        sendResponse({success: true, data: searchResults});
    } catch (error) {
        console.error('Error searching web:', error);
        sendResponse({success: false, error: error.message});
    }
}

// Save analysis to history
function handleSaveAnalysisHistory(data) {
    chrome.storage.local.get(['analysisHistory'], (result) => {
        const history = result.analysisHistory || [];
        history.unshift(data); // Add to beginning
        
        // Keep only last 50 analyses
        if (history.length > 50) {
            history.splice(50);
        }
        
        chrome.storage.local.set({analysisHistory: history});
    });
}

// Get analysis history
function handleGetAnalysisHistory(sendResponse) {
    chrome.storage.local.get(['analysisHistory'], (result) => {
        sendResponse({success: true, data: result.analysisHistory || []});
    });
}

// Save analysis to history helper
function saveAnalysisToHistory(data) {
    chrome.storage.local.get(['analysisHistory'], (result) => {
        const history = result.analysisHistory || [];
        history.unshift(data);
        
        if (history.length > 50) {
            history.splice(50);
        }
        
        chrome.storage.local.set({analysisHistory: history});
    });
}

// Local content analysis (simplified)
function analyzeContentLocally(pageContent, question) {
    const content = pageContent.text.toLowerCase();
    const questionLower = question.toLowerCase();
    
    let analysis = {
        summary: "Based on the page content, here's what I found:\n\n",
        keyPoints: [],
        relevantSections: [],
        suggestions: []
    };
    
    // Detect content type
    if (questionLower.includes('math') || /\d+[\+\-\*\/]\d+/.test(content)) {
        analysis.keyPoints.push("Mathematical content detected");
        analysis.suggestions.push("Look for formulas and numerical examples");
    }
    
    if (questionLower.includes('science') || questionLower.includes('physics') || questionLower.includes('chemistry')) {
        analysis.keyPoints.push("Scientific content detected");
        analysis.suggestions.push("Pay attention to key concepts and definitions");
    }
    
    if (questionLower.includes('history') || /\d{4}/.test(content)) {
        analysis.keyPoints.push("Historical content detected");
        analysis.suggestions.push("Look for dates, events, and key figures");
    }
    
    // Extract relevant sentences
    const sentences = pageContent.text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const words = questionLower.split(/\s+/).filter(w => w.length > 3);
    
    const relevantSentences = sentences.filter(sentence => {
        return words.some(word => sentence.toLowerCase().includes(word));
    });
    
    analysis.relevantSections = relevantSentences.slice(0, 3);
    
    // Generate summary
    analysis.summary += `Found ${relevantSentences.length} relevant sections on this page. `;
    if (pageContent.headings.length > 0) {
        analysis.summary += `The page covers topics including: ${pageContent.headings.slice(0, 3).map(h => h.text).join(', ')}. `;
    }
    
    analysis.suggestions.push("Read through highlighted sections carefully");
    analysis.suggestions.push("Take notes on key concepts");
    analysis.suggestions.push("Look for examples that illustrate main points");
    
    return analysis;
}

// Function to be injected for content extraction
function extractPageContent(includeImages) {
    const content = {
        title: document.title,
        url: window.location.href,
        text: '',
        headings: [],
        images: [],
        metadata: {}
    };

    // Extract headings
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    content.headings = Array.from(headings).map(h => ({
        level: parseInt(h.tagName.charAt(1)),
        text: h.textContent.trim()
    }));

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
                
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }
                
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

    return content;
}

// Badge management for showing analysis count
function updateBadge(tabId, count) {
    if (count > 0) {
        chrome.action.setBadgeText({
            text: count.toString(),
            tabId: tabId
        });
        chrome.action.setBadgeBackgroundColor({
            color: '#4CAF50',
            tabId: tabId
        });
    } else {
        chrome.action.setBadgeText({
            text: '',
            tabId: tabId
        });
    }
}

// Clear badge when tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.action.setBadgeText({
        text: '',
        tabId: activeInfo.tabId
    });
});

// Error handling
chrome.runtime.onInstalled.addListener(() => {
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [{
            id: 1,
            priority: 1,
            action: {
                type: 'allow'
            },
            condition: {
                urlFilter: '*',
                resourceTypes: ['main_frame']
            }
        }]
    });
});