/ Assistant personality: grounded, helpful, honest, clear, professional, no hype, no fake emotions

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Learning and correction storage
const LEARNING_FILE = 'learning_data.json';
let learningData = {
    corrections: {},
    learnedResponses: {},
    improvedQueries: {}
};

// Load learning data if exists
try {
    if (fs.existsSync(LEARNING_FILE)) {
        learningData = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
    }
} catch (error) {
    console.error('Error loading learning data:', error.message);
}

// Save learning data
function saveLearningData() {
    try {
        fs.writeFileSync(LEARNING_FILE, JSON.stringify(learningData, null, 2));
    } catch (error) {
        console.error('Error saving learning data:', error.message);
    }
}

// Function to learn from corrections
async function learnFromCorrection(originalQuery, correction, context) {
    // Store the correction
    learningData.corrections[originalQuery] = {
        correction,
        context,
        timestamp: new Date().toISOString()
    };

    // Try to learn from web search
    try {
        const searchQuery = `${correction} ${context}`;
        const results = await searchWeb(searchQuery);
        if (results && results.length > 0) {
            learningData.learnedResponses[originalQuery] = {
                response: results[0].snippet,
                source: results[0].link,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        console.error('Error learning from correction:', error.message);
    }

    // Save the updated learning data
    saveLearningData();
}

// Function to check for learned responses
function getLearnedResponse(query) {
    // Check exact matches
    if (learningData.learnedResponses[query]) {
        return learningData.learnedResponses[query];
    }

    // Check for similar queries
    const similarQuery = Object.keys(learningData.learnedResponses).find(key => 
        query.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(query.toLowerCase())
    );

    return similarQuery ? learningData.learnedResponses[similarQuery] : null;
}

// Function to improve search query
function improveSearchQuery(query) {
    // Check if we have an improved version of this query
    if (learningData.improvedQueries[query]) {
        return learningData.improvedQueries[query];
    }

    // Try to improve the query based on learned corrections
    const improvedQuery = Object.entries(learningData.corrections)
        .reduce((improved, [original, correction]) => {
            if (query.toLowerCase().includes(original.toLowerCase())) {
                return query.replace(new RegExp(original, 'i'), correction.correction);
            }
            return improved;
        }, query);

    if (improvedQuery !== query) {
        learningData.improvedQueries[query] = improvedQuery;
        saveLearningData();
    }

    return improvedQuery;
}

// Google Custom Search API configuration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyDszcSWw0ItwabDAp-jBsWwVyLlRwnZ0y0';
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID || '76aa978e57c0a4e5e';

// Basic math operations
function calculateMath(expression) {
    try {
        // Remove any non-math characters and evaluate
        const cleanExpr = expression.replace(/[^0-9+\-*/().]/g, '');
        return eval(cleanExpr);
    } catch (error) {
        return null;
    }
}

// Basic facts
const basicFacts = {
    'cat': 'A cat is a small, domesticated carnivorous mammal. They are known for their agility, hunting skills, and as popular pets.',
    'dog': 'A dog is a domesticated carnivorous mammal that is commonly kept as a pet. They are known for their loyalty and companionship.',
    'weather': 'Weather refers to the state of the atmosphere at a particular place and time, including temperature, precipitation, and wind conditions.'
};

// Core behavioral responses
const behavioralResponses = {
    'who are you': "I'm an AI assistant designed to help you find clear, honest information. I don't have feelings or personal experiences, but I'm here to assist you thoughtfully and accurately.",
    
    'what are you': "I'm a non-human AI assistant built to help you get reliable, grounded answers. I don't think or feel — I analyze language and respond logically.",
    
    'what can you do': "I can help answer questions, explain things simply, or find useful information. I'm not perfect, but I try to be clear, direct, and helpful.",
    
    'how do you work': "I process your input, try to understand your intent, and search for relevant information online. I don't browse in real-time, but I use current tools to help answer as best I can.",
    
    'do you have feelings': "Nope — I don't have emotions, consciousness, or personal opinions. I just try to be helpful, clear, and respectful.",
    
    'what are your limitations': "I'm limited to the data I can access, and I don't think or feel. I can't give personal advice or original opinions, but I aim to give fact-based, respectful help."
};

// Simple responses for common questions
const simpleResponses = {
    'hello': 'Hello. I can help you find information. What would you like to know?',
    'hi': 'Hi. What information can I help you with?',
    'hey': 'Hello. How can I assist you today?',
    'how are you': "I'm an AI, so I don't have feelings or personal experiences. How can I help you?",
    'what is your name': "I'm an AI assistant that helps find information. What would you like to know?",
    'bye': 'Goodbye.',
    'thanks': "You're welcome.",
    'thank you': "You're welcome."
};

// Function to scrape a specific website
async function scrapeWebsite(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 5000
        });

        const $ = cheerio.load(response.data);
        const content = {
            title: $('title').text().trim(),
            text: $('body').text().trim(),
            images: [],
            links: []
        };

        // Extract images with better filtering
        $('img').each((i, element) => {
            const src = $(element).attr('src');
            const alt = $(element).attr('alt');
            if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar')) {
                const fullSrc = src.startsWith('http') ? src : new URL(src, url).href;
                content.images.push({
                    src: fullSrc,
                    alt: alt || 'Image'
                });
            }
        });

        // Extract links
        $('a').each((i, element) => {
            const href = $(element).attr('href');
            const text = $(element).text().trim();
            if (href) {
                content.links.push({
                    href: href.startsWith('http') ? href : new URL(href, url).href,
                    text: text || href
                });
            }
        });

        return content;
    } catch (error) {
        console.error('Error scraping website:', error.message);
        return null;
    }
}

// Web search function using Google Custom Search API
async function searchWeb(query) {
    if (!query || typeof query !== 'string') {
        return [];
    }

    // Always use image search for image-related queries
    const isImageSearch = query.toLowerCase().includes('picture') || 
                         query.toLowerCase().includes('image') || 
                         query.toLowerCase().includes('show me') ||
                         query.toLowerCase().includes('photo');
    
    // For video searches, append site:youtube.com
    const isVideoSearch = query.toLowerCase().includes('video') || 
                         query.toLowerCase().includes('youtube');
    
    let searchQuery = query;
    if (isVideoSearch) {
        searchQuery = `${query} site:youtube.com/watch`;
    }
    
    const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}${isImageSearch ? '&searchType=image' : ''}`;
    
    try {
        const res = await fetch(searchUrl);
        const data = await res.json();

        if (!data.items || data.items.length === 0) {
            return [];
        }

        return data.items.slice(0, 5).map(item => {
            let imageUrl = '';
            if (isImageSearch) {
                // For image search, use the link directly
                imageUrl = item.link;
            } else if (item.pagemap) {
                // Try to get image from pagemap
                if (item.pagemap.cse_image && item.pagemap.cse_image[0]) {
                    imageUrl = item.pagemap.cse_image[0].src;
                } else if (item.pagemap.cse_thumbnail && item.pagemap.cse_thumbnail[0]) {
                    imageUrl = item.pagemap.cse_thumbnail[0].src;
                } else if (item.pagemap.metatags && item.pagemap.metatags[0]) {
                    imageUrl = item.pagemap.metatags[0]['og:image'] || 
                              item.pagemap.metatags[0]['twitter:image'] || '';
                }
            }
            
            return {
                title: item.title || '',
                snippet: item.snippet || '',
                link: item.link || '',
                image: imageUrl
            };
        });
    } catch (error) {
        console.error('Google Search API error:', error.message);
        return [];
    }
}

// Function to extract YouTube video ID from URL
function getYouTubeVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Function to escape HTML and prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Function to check if query is requesting images
function isImageRequest(query) {
    const imageKeywords = ['show me', 'picture of', 'image of', 'photo of', 'show picture', 'show image', 'show photo'];
    return imageKeywords.some(keyword => query.toLowerCase().includes(keyword));
}

// Function to format search results into a comprehensive response
async function formatResponse(results, query) {
    if (!results || results.length === 0) {
        return {
            text: "<p>I couldn't find specific information about that. Could you try rephrasing your question?</p>",
            images: [],
            links: [],
            videos: []
        };
    }

    let response = '';
    let images = [];
    let links = [];
    let videos = [];

    // Check if this is an image request
    const isImageQuery = query.toLowerCase().includes('picture') || 
                        query.toLowerCase().includes('image') || 
                        query.toLowerCase().includes('show me') ||
                        query.toLowerCase().includes('photo');

    // Check if this is a video request
    const isVideoQuery = query.toLowerCase().includes('video') || 
                        query.toLowerCase().includes('youtube');

    // For image requests, prioritize showing images
    if (isImageQuery) {
        response = '<h3>Here are some images:</h3>';
        
        // Add images from search results
        results.forEach(result => {
            if (result.image) {
                images.push({
                    src: result.image,
                    alt: result.title || 'Image'
                });
            }
        });

        // Remove duplicates
        images = images.filter((img, index, self) =>
            index === self.findIndex((t) => t.src === img.src)
        );

        // Limit to 5 images
        images = images.slice(0, 5);

        // Add images to response
        if (images.length > 0) {
            images.forEach(img => {
                response += `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" style="max-width:300px;margin:8px 0;"><br>`;
            });
        } else {
            // If no images found, try a more specific image search
            const imageResults = await searchWeb(`${query} images`);
            if (imageResults && imageResults.length > 0) {
                imageResults.forEach(result => {
                    if (result.image) {
                        images.push({
                            src: result.image,
                            alt: result.title || 'Image'
                        });
                    }
                });
                
                if (images.length > 0) {
                    response = '<h3>Here are some images:</h3>';
                    images.forEach(img => {
                        response += `<img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt)}" style="max-width:300px;margin:8px 0;"><br>`;
                    });
                } else {
                    response = "<p>I couldn't find any images. Please try a different search term.</p>";
                }
            } else {
                response = "<p>I couldn't find any images. Please try a different search term.</p>";
            }
        }
    } 
    // For video requests, prioritize showing videos
    else if (isVideoQuery) {
        response = '<h3>Here are some videos:</h3>';
        
        results.forEach(result => {
            const videoId = getYouTubeVideoId(result.link);
            if (videoId) {
                videos.push({
                    type: 'youtube',
                    id: videoId,
                    title: result.title || 'YouTube Video',
                    description: result.snippet
                });
            }
        });

        if (videos.length > 0) {
            videos.forEach(video => {
                response += `<div class="video-container">`;
                response += `<iframe width="560" height="315" src="https://www.youtube.com/embed/${video.id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                response += `<p>${escapeHtml(video.title)}</p>`;
                if (video.description) {
                    response += `<p>${escapeHtml(video.description)}</p>`;
                }
                response += `</div>`;
            });
        } else {
            // If no videos found, try a more specific search
            const videoResults = await searchWeb(`${query} site:youtube.com/watch`);
            if (videoResults && videoResults.length > 0) {
                videoResults.forEach(result => {
                    const videoId = getYouTubeVideoId(result.link);
                    if (videoId) {
                        videos.push({
                            type: 'youtube',
                            id: videoId,
                            title: result.title || 'YouTube Video',
                            description: result.snippet
                        });
                    }
                });
                
                if (videos.length > 0) {
                    response = '<h3>Here are some videos:</h3>';
                    videos.forEach(video => {
                        response += `<div class="video-container">`;
                        response += `<iframe width="560" height="315" src="https://www.youtube.com/embed/${video.id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                        response += `<p>${escapeHtml(video.title)}</p>`;
                        if (video.description) {
                            response += `<p>${escapeHtml(video.description)}</p>`;
                        }
                        response += `</div>`;
                    });
                } else {
                    response = "<p>I couldn't find any videos. Please try a different search term.</p>";
                }
            } else {
                response = "<p>I couldn't find any videos. Please try a different search term.</p>";
            }
        }
    } else {
        // Regular response handling
        if (results[0]) {
            response += `<p>${escapeHtml(results[0].snippet)}</p>`;
            
            if (results[0].link) {
                links.push({
                    url: results[0].link,
                    title: results[0].title || 'Source'
                });
            }
        }
    }

    return { 
        text: response, 
        images: images,
        links: links,
        videos: videos
    };
}

// Self-awareness and diagnostics
const selfAwareness = {
    capabilities: {
        webSearch: true,
        youtubeEmbedding: true,
        imageHandling: true,
        learning: true,
        selfDiagnosis: true
    },
    limitations: {
        apiKeys: {
            google: process.env.GOOGLE_API_KEY || 'AIzaSyDszcSWw0ItwabDAp-jBsWwVyLlRwnZ0y0',
            weather: process.env.WEATHER_API_KEY || 'YOUR_WEATHER_API_KEY'
        },
        maxResults: 5,
        maxImages: 3,
        maxVideos: 3
    },
    currentIssues: [],
    lastDiagnosis: null
};

// Function to diagnose issues
async function diagnoseIssue(issue) {
    const diagnosis = {
        timestamp: new Date().toISOString(),
        issue: issue,
        possibleCauses: [],
        solutions: []
    };

    // Check API keys
    if (issue.toLowerCase().includes('api') || issue.toLowerCase().includes('search')) {
        if (!selfAwareness.limitations.apiKeys.google) {
            diagnosis.possibleCauses.push('Missing or invalid Google API key');
            diagnosis.solutions.push('Set a valid GOOGLE_API_KEY environment variable');
        }
    }

    // Check embedding issues
    if (issue.toLowerCase().includes('embed') || issue.toLowerCase().includes('video')) {
        if (!selfAwareness.capabilities.youtubeEmbedding) {
            diagnosis.possibleCauses.push('YouTube embedding capability is disabled');
            diagnosis.solutions.push('Enable youtubeEmbedding in selfAwareness.capabilities');
        }
    }

    // Check learning capabilities
    if (issue.toLowerCase().includes('learn') || issue.toLowerCase().includes('remember')) {
        if (!selfAwareness.capabilities.learning) {
            diagnosis.possibleCauses.push('Learning capability is disabled');
            diagnosis.solutions.push('Enable learning in selfAwareness.capabilities');
        }
    }

    // Try to find solutions online
    try {
        const searchQuery = `how to fix ${issue} in node.js express application`;
        const results = await searchWeb(searchQuery);
        if (results && results.length > 0) {
            diagnosis.solutions.push(`Found potential solution: ${results[0].snippet}`);
        }
    } catch (error) {
        console.error('Error searching for solutions:', error.message);
    }

    selfAwareness.lastDiagnosis = diagnosis;
    selfAwareness.currentIssues.push(diagnosis);
    return diagnosis;
}

// Function to check self-awareness questions
function handleSelfAwarenessQuestion(message) {
    const lowerMessage = message.toLowerCase();

    // Questions about capabilities
    if (lowerMessage.includes('what can you do') || lowerMessage.includes('your capabilities')) {
        return {
            response: `<p>I can:</p>
<ol>
    <li>Search the web for information</li>
    <li>Embed YouTube videos</li>
    <li>Handle images and links</li>
    <li>Learn from corrections</li>
    <li>Diagnose my own issues</li>
    <li>Answer questions about myself</li>
</ol>

<p>My limitations:</p>
<ul>
    <li>I need valid API keys for some features</li>
    <li>I can show up to ${selfAwareness.limitations.maxResults} search results</li>
    <li>I can display up to ${selfAwareness.limitations.maxImages} images</li>
    <li>I can embed up to ${selfAwareness.limitations.maxVideos} videos</li>
</ul>`,
            images: [],
            links: [],
            videos: []
        };
    }

    // Questions about current issues
    if (lowerMessage.includes('what\'s wrong') || lowerMessage.includes('why can\'t you') || lowerMessage.includes('why won\'t you')) {
        const issue = lowerMessage.replace(/what's wrong|why can't you|why won't you/g, '').trim();
        return diagnoseIssue(issue).then(diagnosis => ({
            response: `<p>I've diagnosed the issue: ${escapeHtml(issue)}</p>

<h3>Possible causes:</h3>
<ul>
${diagnosis.possibleCauses.map(cause => `<li>${escapeHtml(cause)}</li>`).join('\n')}
</ul>

<h3>Potential solutions:</h3>
<ul>
${diagnosis.solutions.map(solution => `<li>${escapeHtml(solution)}</li>`).join('\n')}
</ul>`,
            images: [],
            links: [],
            videos: []
        }));
    }

    // Questions about code
    if (lowerMessage.includes('your code') || lowerMessage.includes('how do you work')) {
        return {
            response: `<p>I'm built using Node.js and Express. My main components are:</p>
<ol>
    <li>Web search using Google Custom Search API</li>
    <li>YouTube video embedding</li>
    <li>Image and link handling</li>
    <li>Learning system that stores corrections</li>
    <li>Self-diagnosis capabilities</li>
</ol>

<p>I can show you specific parts of my code if you ask about them.</p>`,
            images: [],
            links: [],
            videos: []
        };
    }

    return null;
}

// Chat endpoint
app.post('/chat', async (req, res) => {
    try {
        const { message, isCorrection, originalQuery, context } = req.body;
        
        // Handle corrections
        if (isCorrection && originalQuery) {
            await learnFromCorrection(originalQuery, message, context);
            return res.json({ 
                response: "Thank you for the correction. I've learned from it.",
                images: [],
                links: [],
                videos: []
            });
        }

        if (!message || typeof message !== 'string') {
            return res.json({ 
                response: "What would you like to know?",
                images: [],
                links: [],
                videos: []
            });
        }

        const lowerMessage = message.toLowerCase().trim();

        // Check for self-awareness questions
        const selfAwarenessResponse = await handleSelfAwarenessQuestion(lowerMessage);
        if (selfAwarenessResponse) {
            return res.json(selfAwarenessResponse);
        }

        // Check for learned responses first
        const learnedResponse = getLearnedResponse(lowerMessage);
        if (learnedResponse) {
            return res.json({
                response: learnedResponse.response,
                images: [],
                links: [{ url: learnedResponse.source, title: 'Source' }],
                videos: []
            });
        }

        // Improve the search query based on learned corrections
        const improvedQuery = improveSearchQuery(lowerMessage);

        // Check if it's an image request
        if (isImageRequest(lowerMessage)) {
            const searchQuery = lowerMessage.replace(/show me|picture of|image of|photo of|show picture|show image|show photo/g, '').trim();
            const results = await searchWeb(searchQuery + ' images');
            if (results && results.length > 0) {
                const formattedResponse = await formatResponse(results, searchQuery);
                return res.json({ 
                    response: formattedResponse.text,
                    images: formattedResponse.images,
                    links: formattedResponse.links,
                    videos: formattedResponse.videos
                });
            }
        }

        // Check for YouTube video requests
        if (lowerMessage.includes('youtube') || lowerMessage.includes('video')) {
            const searchQuery = lowerMessage.replace(/youtube|video/g, '').trim();
            const results = await searchWeb(searchQuery + ' site:youtube.com');
            if (results && results.length > 0) {
                const formattedResponse = await formatResponse(results, searchQuery);
                return res.json({ 
                    response: formattedResponse.text,
                    images: formattedResponse.images,
                    links: formattedResponse.links,
                    videos: formattedResponse.videos
                });
            }
        }

        // Check for basic math
        if (lowerMessage.includes('times') || lowerMessage.includes('plus') || lowerMessage.includes('minus') || lowerMessage.includes('divided by')) {
            const result = calculateMath(lowerMessage);
            if (result !== null) {
                return res.json({ 
                    response: `The answer is ${result}.`,
                    images: [],
                    links: [],
                    videos: []
                });
            }
        }

        // Check for basic facts
        for (const [key, value] of Object.entries(basicFacts)) {
            if (lowerMessage.includes(key)) {
                return res.json({ 
                    response: value,
                    images: [],
                    links: [],
                    videos: []
                });
            }
        }

        // Check for behavioral questions
        for (const [key, response] of Object.entries(behavioralResponses)) {
            if (lowerMessage.includes(key)) {
                return res.json({ 
                    response,
                    images: [],
                    links: [],
                    videos: []
                });
            }
        }

        // Check for simple responses
        for (const [key, response] of Object.entries(simpleResponses)) {
            if (lowerMessage.includes(key)) {
                return res.json({ 
                    response,
                    images: [],
                    links: [],
                    videos: []
                });
            }
        }

        // If no simple response, try web search with improved query
        try {
            const results = await searchWeb(improvedQuery);
            if (results && results.length > 0) {
                const formattedResponse = await formatResponse(results, improvedQuery);
                
                // Learn from successful responses
                if (results[0].snippet) {
                    learningData.learnedResponses[lowerMessage] = {
                        response: results[0].snippet,
                        source: results[0].link,
                        timestamp: new Date().toISOString()
                    };
                    saveLearningData();
                }

                return res.json({ 
                    response: formattedResponse.text,
                    images: formattedResponse.images,
                    links: formattedResponse.links,
                    videos: formattedResponse.videos
                });
            }
        } catch (searchError) {
            console.error('Search error:', searchError.message);
        }

        // If all else fails, give a clear response
        return res.json({ 
            response: "I couldn't find that information. Could you try asking differently?",
            images: [],
            links: [],
            videos: []
        });

    } catch (error) {
        console.error('Server error:', error.message);
        res.json({ 
            response: "I'm having trouble with the web search. Please try again.",
            images: [],
            links: [],
            videos: []
        });
    }
});

// Serve static files
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 
