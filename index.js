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
let isProcessing = false; // Add this flag to track assistant's processing state

(async () => {
  // Initialize browser and get initial DOM
  const { client: cdpClient, chrome } = await launchBrowser(startingUrl);
  client = cdpClient;
  chromeInstance = chrome;


  // Initialize system prompt with the normalized DOM
  const systemMessage = initializeSystemPrompt('');
  messages.unshift(systemMessage);

  // Start interaction
  setupCLI(
    async (input) => {
      // On user input
      if (isProcessing) {
        console.log('Assistant is processing your previous request. Please wait...');
        return;
      }

      isProcessing = true; // Set the flag to indicate processing has started
      messages.push({ role: 'user', content: input });
      try {
        const response = await processAssistantResponse(messages, client, processedDom, domRepresentation);
        processedDom = response.processedDom;
        domRepresentation = response.domRepresentation;
      } catch (error) {
        console.error('Error:', error);
      } finally {
        isProcessing = false; // Reset the flag after processing is done
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
