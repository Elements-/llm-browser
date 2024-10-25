import { launch } from 'chrome-launcher';
import CDP from 'chrome-remote-interface';

export async function launchBrowser(url) {
  // Launch Chrome with remote debugging and starting URL
  const chrome = await launch({
    startingUrl: url,
    chromeFlags: [
      '--no-first-run',
      '--disable-popup-blocking',
    ],
    userDataDir: './chrome-profile',
  });

  // Define a cleanup function to kill Chrome on exit
  const cleanup = () => {
    if (chrome && chrome.kill) {
      chrome.kill()
    }
  };

  // Register cleanup on various process exit events
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

    // Destructure necessary domains from the client
    const { Network, Page, Runtime, Target } = client;

    // Enable necessary domains
    await Network.enable();
    await Page.enable();

    // **Enable the Target domain to monitor target events**
    await Target.setDiscoverTargets({ discover: true });

    // **Listen for new target creations and close them immediately**
    Target.targetCreated(async ({ targetInfo }) => {
      if (targetInfo.type === 'page' && targetInfo.openerId) {
        await Target.closeTarget({ targetId: targetInfo.targetId });
      }
    });

    // Intercept window.open calls and links with target="_blank"
    Page.windowOpen(async ({ url }) => {
      await Page.navigate({ url });
      await Page.loadEventFired();
    });

    return { chrome, client };
  } catch (err) {
    console.error('Error during processing:', err);
    cleanup();
    throw err;
  }
}

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
