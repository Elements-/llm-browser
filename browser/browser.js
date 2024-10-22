import { launch } from 'chrome-launcher';
import CDP from 'chrome-remote-interface';

// Function to launch the browser and extract the DOM
export async function launchBrowser(url) {
  // Launch Chrome with remote debugging and starting URL
  const chrome = await launch({
    startingUrl: url,
    chromeFlags: ['--no-first-run'],
    userDataDir: './chrome-profile',
  });

  // Cleanup function to kill Chrome
  const cleanup = () => {
    if (chrome && chrome.kill) {
      chrome.kill()?.catch((err) => {
        console.error('Error killing Chrome:', err);
      });
    }
  };

  // Register cleanup on process exit
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit();
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit();
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    cleanup();
    process.exit(1);
  });

  try {
    // Connect to the Chrome DevTools Protocol on the same port
    const client = await CDP({ port: chrome.port });

    // Extract domains we need
    const { Network, Page, DOM, CSS } = client;

    // Enable events on domains we are interested in
    await Network.enable();
    await Page.enable();
    await DOM.enable();
    await CSS.enable();

    // Wait for the page to load
    //await Page.loadEventFired();

    return { chrome, client };
  } catch (err) {
    console.error('Error during processing:', err);
    cleanup();
    throw err;
  }
}

// Function to execute a command (click, input, navigate)
export async function executeCommand(client, command) {
  if (command.type === 'click') {
    const { execute } = await import('./commands/click.js');
    await execute(client, command);
  } else if (command.type === 'input') {
    const { execute } = await import('./commands/input.js');
    await execute(client, command);
  } else if (command.type === 'goto') {
    const { execute } = await import('./commands/navigate.js');
    await execute(client, command);
  } else if (command.type === 'select') {
    const { execute } = await import('./commands/select.js');
    await execute(client, command);
  }
}
