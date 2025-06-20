const { spawn } = require('child_process');
const readline = require('readline');

let serverProcess = null;

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to start the server
function startServer() {
    console.log('Starting server...');
    serverProcess = spawn('node', ['index.js'], {
        stdio: 'inherit'
    });

    serverProcess.on('error', (error) => {
        console.error('Failed to start server:', error);
    });

    serverProcess.on('exit', (code) => {
        if (code !== null) {
            console.log(`Server process exited with code ${code}`);
        }
    });
}

// Function to stop the server
function stopServer() {
    if (serverProcess) {
        console.log('Stopping server...');
        serverProcess.kill();
        serverProcess = null;
        console.log('Server stopped.');
    } else {
        console.log('Server is not running.');
    }
}

// Function to reset the server
function resetServer() {
    console.log('Resetting server...');
    stopServer();
    startServer();
}

// Handle user commands
function handleCommand(command) {
    switch (command.toLowerCase()) {
        case 'start':
            if (!serverProcess) {
                startServer();
            } else {
                console.log('Server is already running.');
            }
            break;
        case 'stop':
            stopServer();
            break;
        case 'reset':
            resetServer();
            break;
        case 'exit':
            stopServer();
            rl.close();
            process.exit(0);
            break;
        case 'help':
            console.log('\nAvailable commands:');
            console.log('  start  - Start the server');
            console.log('  stop   - Stop the server');
            console.log('  reset  - Restart the server');
            console.log('  help   - Show this help message');
            console.log('  exit   - Stop server and exit\n');
            break;
        default:
            console.log('Unknown command. Type "help" for available commands.');
    }
}

// Start the server initially
startServer();

// Handle user input
console.log('\nServer control commands:');
console.log('Type "help" for available commands\n');

rl.on('line', (input) => {
    handleCommand(input.trim());
}); 