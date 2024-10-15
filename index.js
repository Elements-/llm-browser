import './utils/config.js';

import { setupCLI } from './cli/interface.js';
import { launchBrowser } from './browser/browser.js';
import { processDom } from './browser/domProcessor.js';
import { processAssistantResponse, initializeSystemPrompt } from './assistant/assistant.js';

const startingUrl = 'https://google.com';

let client;
let chromeInstance;
let processedDom;
let domRepresentation;
let messages = [];

(async () => {
  // Initialize browser and get initial DOM
  const { domRepresentation: initialDomRepresentation, client: cdpClient, chrome } = await launchBrowser(startingUrl);
  client = cdpClient;
  chromeInstance = chrome;
  domRepresentation = initialDomRepresentation;

  // Process DOM
  processedDom = processDom(domRepresentation);

  // Initialize system prompt with the normalized DOM
  const systemMessage = initializeSystemPrompt(processedDom);
  messages.unshift(systemMessage);

  // Start interaction
  setupCLI(
    async (input) => {
      // On user input
      messages.push({ role: 'user', content: input });
      try {
        const response = await processAssistantResponse(messages, client, processedDom, domRepresentation, );
        processedDom = response.processedDom;
        domRepresentation = response.domRepresentation;
      } catch (error) {
        console.error('Error:', error);
      }
    },
    async () => {
      // On close
      await client.close();
      await chromeInstance.kill();
      console.log('Session ended');
      process.exit(0);
    }
  );
})();
