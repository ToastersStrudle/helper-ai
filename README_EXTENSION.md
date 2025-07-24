# 🎓 Homework Helper Chrome Extension

A powerful Chrome extension that helps students with homework by analyzing web pages and providing AI-powered assistance.

## Features

- 📚 **Smart Page Analysis**: Automatically extracts and analyzes content from educational websites
- 🔍 **Text Highlighting**: Highlights relevant information based on your questions
- ⚡ **Quick Access**: Floating button and keyboard shortcuts for instant help
- 🎯 **Subject Detection**: Recognizes math, science, history, and other academic subjects
- 📝 **Context-Aware Help**: Provides explanations and study tips based on page content
- 🖱️ **Text Selection**: Right-click any text for instant homework assistance

## Installation

### Method 1: Load Unpacked Extension (Developer Mode)

1. **Enable Developer Mode** in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Toggle "Developer mode" in the top-right corner

2. **Load the Extension**:
   - Click "Load unpacked"
   - Select the folder containing these extension files
   - The extension should now appear in your extensions list

3. **Pin the Extension** (Optional):
   - Click the puzzle piece icon in Chrome's toolbar
   - Pin the Homework Helper extension for easy access

### Method 2: Create Extension Package

1. **Zip the Extension Files**:
   ```bash
   zip -r homework-helper.zip manifest.json popup.html popup.js content.js background.js welcome.html *.png
   ```

2. **Install from Package**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the unzipped folder

## How to Use

### Basic Usage

1. **Navigate** to any educational website or homework-related page
2. **Click** the 🎓 floating button in the bottom-right corner
3. **Type** your question in the popup window
4. **Click** "Analyze & Answer" to get help
5. **Review** the analysis and highlighted content

### Advanced Features

#### Keyboard Shortcuts
- `Ctrl+Shift+H` - Open Homework Helper
- `Ctrl+Shift+S` - Toggle selection mode
- `Esc` - Clear highlights and exit selection mode

#### Context Menu
- **Right-click** on selected text → "Get homework help with this text"
- **Right-click** on page → "Analyze this page for homework help"

#### Text Selection
- **Select text** on any page to see a quick help tooltip
- **Click** the tooltip to get detailed explanations

### Settings

- **Include images in analysis** - Analyze mathematical equations and diagrams
- **Auto-highlight answers** - Automatically highlight relevant content

## File Structure

```
homework-helper/
├── manifest.json          # Extension configuration
├── popup.html             # Main popup interface
├── popup.js               # Popup functionality
├── content.js             # Content script for web pages
├── background.js          # Background service worker
├── welcome.html           # Welcome page shown on install
├── icon16.png            # 16x16 icon (add your own)
├── icon48.png            # 48x48 icon (add your own)
├── icon128.png           # 128x128 icon (add your own)
└── README_EXTENSION.md   # This file
```

## Technical Details

### Permissions Used

- `activeTab` - Access to current tab content
- `storage` - Save user settings and analysis history
- `scripting` - Inject content scripts for page analysis
- `<all_urls>` - Access to all websites (for comprehensive analysis)

### How It Works

1. **Content Extraction**: Uses TreeWalker API to intelligently extract text, images, tables, and mathematical content
2. **AI Analysis**: Processes content using pattern matching and keyword analysis (can be extended with AI APIs)
3. **Highlighting**: Dynamically highlights relevant content using DOM manipulation
4. **Storage**: Saves analysis history and user preferences using Chrome Storage API

## Extending the Extension

### Adding AI Integration

To connect to real AI services (OpenAI, Google Gemini, etc.), modify the `analyzeContent` function in `popup.js`:

```javascript
async function analyzeContent(pageContent, question) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer YOUR_API_KEY',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{
                role: 'user',
                content: `Based on this content: ${pageContent.text}\n\nAnswer: ${question}`
            }]
        })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
}
```

### Adding New Features

- **Export Notes**: Add functionality to export analysis results
- **Study Sessions**: Track study time and progress
- **Collaborative Features**: Share analyses with classmates
- **Subject-Specific Tools**: Add calculators, formula references, etc.

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Ensure all files are in the same directory
   - Check that Developer mode is enabled
   - Refresh the extensions page

2. **No floating button appears**
   - Check if the content script is blocked by the website
   - Try refreshing the page
   - Verify permissions are granted

3. **Analysis not working**
   - Ensure the page has sufficient text content
   - Check browser console for errors
   - Try a different website

### Browser Console

Check for errors in the browser console:
- Press `F12` or `Ctrl+Shift+I`
- Look for red error messages
- Check both the page console and extension popup console

## Privacy and Security

- **Local Processing**: Basic analysis is done locally in the browser
- **No Data Collection**: No personal information is sent to external servers
- **Secure Storage**: Settings stored locally using Chrome's secure storage API
- **Minimal Permissions**: Only requests necessary permissions for functionality

## Contributing

To improve this extension:

1. Fork the repository
2. Make your changes
3. Test thoroughly on different websites
4. Submit a pull request

## License

This project is open source and available under the MIT License.

## Disclaimer

This tool is designed to help with understanding and learning. It should be used as a study aid, not as a replacement for doing your own homework. Always follow your school's academic integrity policies.