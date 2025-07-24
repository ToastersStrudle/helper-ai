// Content script for Homework Helper Chrome Extension
// This script runs on all web pages to provide enhanced functionality

(function() {
    'use strict';

    // Prevent multiple injections
    if (window.homeworkHelperInjected) {
        return;
    }
    window.homeworkHelperInjected = true;

    // Global variables
    let isSelectionMode = false;
    let selectedText = '';
    let originalStyles = new Map();

    // Initialize the extension
    init();

    function init() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // Add context menu for text selection
        document.addEventListener('mouseup', handleTextSelection);
        
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener(handleMessage);
        
        // Add floating action button for quick access
        addFloatingButton();
    }

    function handleKeyboardShortcuts(event) {
        // Ctrl+Shift+H - Quick homework help
        if (event.ctrlKey && event.shiftKey && event.key === 'H') {
            event.preventDefault();
            triggerHomeworkHelper();
        }
        
        // Ctrl+Shift+S - Selection mode toggle
        if (event.ctrlKey && event.shiftKey && event.key === 'S') {
            event.preventDefault();
            toggleSelectionMode();
        }
        
        // Escape - Clear highlights and exit selection mode
        if (event.key === 'Escape') {
            clearHighlights();
            exitSelectionMode();
        }
    }

    function handleTextSelection(event) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText.length > 10) {
            showQuickHelpTooltip(event.clientX, event.clientY, selectedText);
        }
    }

    function handleMessage(request, sender, sendResponse) {
        switch (request.action) {
            case 'getPageContent':
                sendResponse(extractAdvancedPageContent(request.includeImages));
                break;
            case 'highlightContent':
                highlightRelevantContent(request.terms);
                sendResponse({success: true});
                break;
            case 'clearHighlights':
                clearHighlights();
                sendResponse({success: true});
                break;
            case 'enterSelectionMode':
                enterSelectionMode();
                sendResponse({success: true});
                break;
            case 'exitSelectionMode':
                exitSelectionMode();
                sendResponse({success: true});
                break;
        }
    }

    function extractAdvancedPageContent(includeImages = true) {
        const content = {
            title: document.title,
            url: window.location.href,
            text: '',
            headings: [],
            images: [],
            links: [],
            metadata: {},
            equations: [],
            tables: [],
            lists: [],
            selectedText: getSelectedText()
        };

        // Extract headings
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        content.headings = Array.from(headings).map(h => ({
            level: parseInt(h.tagName.charAt(1)),
            text: h.textContent.trim()
        }));

        // Extract main text content with better structure preservation
        content.text = extractStructuredText();

        // Extract mathematical equations (MathJax, KaTeX, etc.)
        content.equations = extractMathematicalContent();

        // Extract tables
        content.tables = extractTableData();

        // Extract lists
        content.lists = extractListData();

        // Extract images with better context
        if (includeImages) {
            content.images = extractImageData();
        }

        // Extract important links
        content.links = extractLinkData();

        // Extract metadata
        content.metadata = extractMetadata();

        return content;
    }

    function extractStructuredText() {
        const contentElements = document.querySelectorAll('p, div, article, section, main, .content, .article-body, .post-content, .entry-content');
        let text = '';
        
        contentElements.forEach(element => {
            const elementText = element.textContent.trim();
            if (elementText.length > 50 && !isNavigationElement(element)) {
                text += elementText + '\n\n';
            }
        });

        // Fallback to body text if no structured content found
        if (text.length < 100) {
            text = document.body.textContent.replace(/\s+/g, ' ').trim();
        }

        return text;
    }

    function isNavigationElement(element) {
        const navSelectors = ['nav', 'header', 'footer', 'aside', '.navigation', '.menu', '.sidebar'];
        return navSelectors.some(selector => 
            element.matches(selector) || element.closest(selector)
        );
    }

    function extractMathematicalContent() {
        const equations = [];
        
        // MathJax equations
        const mathJaxElements = document.querySelectorAll('.MathJax, .math, [class*="katex"]');
        mathJaxElements.forEach(element => {
            equations.push({
                type: 'rendered',
                content: element.textContent || element.getAttribute('alt') || ''
            });
        });

        // LaTeX-style equations in text
        const latexMatches = document.body.textContent.match(/\$[^$]+\$|\\\[[^\]]+\\\]|\\\([^)]+\\\)/g);
        if (latexMatches) {
            latexMatches.forEach(match => {
                equations.push({
                    type: 'latex',
                    content: match
                });
            });
        }

        return equations;
    }

    function extractTableData() {
        const tables = [];
        const tableElements = document.querySelectorAll('table');
        
        tableElements.forEach(table => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
            const rows = Array.from(table.querySelectorAll('tr')).slice(headers.length > 0 ? 1 : 0).map(row => 
                Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim())
            );
            
            if (headers.length > 0 || rows.length > 0) {
                tables.push({ headers, rows });
            }
        });
        
        return tables;
    }

    function extractListData() {
        const lists = [];
        const listElements = document.querySelectorAll('ul, ol');
        
        listElements.forEach(list => {
            const items = Array.from(list.querySelectorAll('li')).map(li => li.textContent.trim());
            if (items.length > 0) {
                lists.push({
                    type: list.tagName.toLowerCase(),
                    items: items
                });
            }
        });
        
        return lists;
    }

    function extractImageData() {
        const images = [];
        const imgElements = document.querySelectorAll('img');
        
        imgElements.forEach(img => {
            if (img.alt || img.title || img.src.includes('equation') || img.src.includes('formula')) {
                images.push({
                    src: img.src,
                    alt: img.alt || '',
                    title: img.title || '',
                    context: getImageContext(img)
                });
            }
        });
        
        return images;
    }

    function getImageContext(img) {
        const parent = img.closest('figure, div, p');
        if (parent) {
            const caption = parent.querySelector('figcaption, .caption');
            if (caption) {
                return caption.textContent.trim();
            }
            
            const siblings = Array.from(parent.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .join(' ');
            
            return siblings.substring(0, 200);
        }
        return '';
    }

    function extractLinkData() {
        const links = [];
        const linkElements = document.querySelectorAll('a[href]');
        
        Array.from(linkElements)
            .filter(link => link.textContent.trim().length > 0)
            .forEach(link => {
                links.push({
                    text: link.textContent.trim(),
                    href: link.href,
                    isExternal: !link.href.includes(window.location.hostname)
                });
            });
        
        return links.slice(0, 20); // Limit to top 20 links
    }

    function extractMetadata() {
        const metadata = {};
        
        // Meta tags
        const metaTags = document.querySelectorAll('meta[name], meta[property]');
        metaTags.forEach(meta => {
            const name = meta.getAttribute('name') || meta.getAttribute('property');
            const content = meta.getAttribute('content');
            if (name && content) {
                metadata[name] = content;
            }
        });
        
        // Schema.org structured data
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                if (data['@type']) {
                    metadata.schemaType = data['@type'];
                    metadata.schemaData = data;
                }
            } catch (e) {
                // Ignore invalid JSON
            }
        });
        
        return metadata;
    }

    function getSelectedText() {
        const selection = window.getSelection();
        return selection.toString().trim();
    }

    function showQuickHelpTooltip(x, y, text) {
        // Remove existing tooltip
        const existingTooltip = document.getElementById('homework-helper-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        const tooltip = document.createElement('div');
        tooltip.id = 'homework-helper-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            top: ${y + 10}px;
            left: ${x}px;
            background: #2196F3;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            max-width: 200px;
            word-wrap: break-word;
        `;
        tooltip.textContent = '🎓 Get help with this text';
        
        tooltip.addEventListener('click', () => {
            triggerHomeworkHelperWithText(text);
            tooltip.remove();
        });

        document.body.appendChild(tooltip);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.remove();
            }
        }, 3000);
    }

    function addFloatingButton() {
        const button = document.createElement('div');
        button.id = 'homework-helper-fab';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: transform 0.2s;
        `;
        button.innerHTML = '🎓';
        button.title = 'Homework Helper (Ctrl+Shift+H)';
        
        button.addEventListener('click', triggerHomeworkHelper);
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });

        document.body.appendChild(button);
    }

    function triggerHomeworkHelper() {
        chrome.runtime.sendMessage({action: 'openPopup'});
    }

    function triggerHomeworkHelperWithText(text) {
        chrome.runtime.sendMessage({
            action: 'openPopupWithText',
            text: text
        });
    }

    function highlightRelevantContent(terms) {
        clearHighlights();
        
        if (!terms || terms.length === 0) return;

        const pattern = new RegExp('\\b(' + terms.map(term => 
            term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        ).join('|') + ')\\b', 'gi');

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    
                    // Skip script, style, and already highlighted elements
                    if (parent.matches('script, style, .homework-helper-highlight')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (pattern.test(node.textContent)) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const highlightedHTML = text.replace(pattern, 
                '<span class="homework-helper-highlight" style="background-color: #ffeb3b; padding: 1px 2px; border-radius: 2px; font-weight: 500;">$1</span>'
            );
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = highlightedHTML;
            
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
            
            textNode.parentNode.replaceChild(fragment, textNode);
        });
    }

    function clearHighlights() {
        const highlights = document.querySelectorAll('.homework-helper-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });
    }

    function toggleSelectionMode() {
        if (isSelectionMode) {
            exitSelectionMode();
        } else {
            enterSelectionMode();
        }
    }

    function enterSelectionMode() {
        isSelectionMode = true;
        document.body.style.cursor = 'crosshair';
        
        // Add visual indicator
        const indicator = document.createElement('div');
        indicator.id = 'homework-helper-selection-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #4CAF50;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 10001;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        indicator.textContent = 'Selection Mode Active - Click text to get help (Esc to exit)';
        
        document.body.appendChild(indicator);
        
        // Add click handlers
        document.addEventListener('click', handleSelectionClick, true);
    }

    function exitSelectionMode() {
        isSelectionMode = false;
        document.body.style.cursor = '';
        
        const indicator = document.getElementById('homework-helper-selection-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        document.removeEventListener('click', handleSelectionClick, true);
    }

    function handleSelectionClick(event) {
        if (!isSelectionMode) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const element = event.target;
        const text = element.textContent.trim();
        
        if (text.length > 10) {
            triggerHomeworkHelperWithText(text);
            exitSelectionMode();
        }
    }

})();