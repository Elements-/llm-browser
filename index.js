import { generateSystemPrompt } from './config.js';
import { setupCLI } from './cli/interface.js';
import { launchBrowser } from './browser/browser.js';
import { processAssistantResponse } from './assistant/assistant.js';

const startingUrl = 'https://google.com';

let client;
let chromeInstance;
let domTree;
let messages = [];
let isProcessing = false;

(async () => {
  // Initialize browser
  const { client: cdpClient, chrome } = await launchBrowser(startingUrl);
  client = cdpClient;
  chromeInstance = chrome;
  

  // Start interaction
  setupCLI(
    async (input) => {
      // On user input
      if (isProcessing) {
        console.log('Assistant is processing your previous request. Please wait...');
        return;
      }

      isProcessing = true;

      if(messages.length === 0) {
        messages.push({ role: 'system', content: generateSystemPrompt({ task: input }) });
      }
      else {
        messages.push({ role: 'user', content: input });
      }

      try {
        const response = await processAssistantResponse(input, messages, client, domTree);
        domTree = response.domTree;
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
