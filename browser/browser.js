import { launch } from 'chrome-launcher';
import CDP from 'chrome-remote-interface';
import { processNode } from './domExtractor.js';

// Function to launch the browser and extract the DOM
export async function launchBrowser(url) {
  // Launch Chrome with remote debugging and starting URL
  const chrome = await launch({
    startingUrl: url,
    chromeFlags: ['--disable-gpu', '--no-first-run'],
  });

  try {
    // Connect to the Chrome DevTools Protocol on the same port
    const client = await CDP({ port: chrome.port });

    // Extract domains we need
    const { Network, Page, DOM } = client;

    // Enable events on domains we are interested in
    await Network.enable();
    await Page.enable();
    await DOM.enable();

    // Wait for the page to load
    await Page.loadEventFired();

    // Get the root DOM node (#document)
    const { root } = await DOM.getDocument();

    // Start processing from the root node
    const domRepresentation = await processNode(root.backendNodeId, client);

    return { domRepresentation, client, chrome };
  } catch (err) {
    console.error('Error during processing:', err);
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
