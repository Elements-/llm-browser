import { systemPrompt } from './config.js';
import { setupCLI } from './cli/interface.js';
import { launchBrowser } from './browser/browser.js';
import { processAssistantResponse } from './assistant/assistant.js';

const startingUrl = 'https://google.com';

let client;
let chromeInstance;
let processedDom;
let domRepresentation;
let messages = [];
let isProcessing = false;

(async () => {
  // Initialize browser and get initial DOM
  const { client: cdpClient, chrome } = await launchBrowser(startingUrl);
  client = cdpClient;
  chromeInstance = chrome;

  // Initialize system prompt
  messages.unshift({
    role: 'system',
    content: systemPrompt,
  });

  // Start interaction
  setupCLI(
    async (input) => {
      // On user input
      if (isProcessing) {
        console.log('Assistant is processing your previous request. Please wait...');
        return;
      }

      isProcessing = true;
      messages.push({ role: 'user', content: input });
      try {
        const response = await processAssistantResponse(messages, client, processedDom, domRepresentation);
        processedDom = response.processedDom;
        domRepresentation = response.domRepresentation;
      } catch (error) {
        console.error('Error:', error);
      } finally {
        isProcessing = false;
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
