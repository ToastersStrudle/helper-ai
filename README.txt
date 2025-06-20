Coding Assistant AI - Setup and Usage Instructions

This is an AI-powered coding assistant that can help you with programming questions and problems. It uses Google's Gemini AI model and web search capabilities to provide accurate and helpful responses.

Prerequisites:
1. Node.js installed on your computer (version 14 or higher)
2. A Google Gemini API key (get one from https://makersuite.google.com/app/apikey)

Setup Instructions: make ure to do this run cd "C:\Users\yourname\Downloads\new ai" && npm install in powershell

1. Install Dependencies:
   Open a terminal in the project directory and run:
   npm install

2. Create Environment File:
   Create a new file named '.env' in the project root directory and add your Gemini API key:
   GEMINI_API_KEY=your_api_key_here

3. Start the Application:
   Run the following command in the terminal:
   npm start

4. Access the Application:
   Open your web browser and go to:
   http://localhost:3000

Usage:
1. Type your coding question or problem in the input field
2. Press Enter or click the Send button
3. The AI will search the web for relevant information and provide a response
4. You can ask follow-up questions or request clarification

Features:
- Real-time web search integration
- Code formatting and syntax highlighting
- Natural language processing
- Context-aware responses
- Support for multiple programming languages

Tips:
- Be specific in your questions
- Include relevant code snippets when asking about code issues
- You can ask for explanations, debugging help, or code examples
- The AI can help with various programming languages and frameworks

Note: The application requires an active internet connection to function properly, as it uses web search capabilities and the Gemini API.

Troubleshooting:
If you encounter any issues:
1. Make sure all dependencies are installed correctly
2. Verify your Gemini API key is valid and properly set in the .env file
3. Check your internet connection
4. Ensure no other application is using port 3000 