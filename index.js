import './utils/config.js';

import { setupCLI } from './cli/interface.js';
import { launchBrowser } from './browser/browser.js';
import { processSupervisorResponse } from './supervisor/supervisor.js';
import { extractDOM } from './browser/domExtractor.js';
import { processDom } from './browser/domProcessor.js';

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

  // Extract initial DOM representation
  const initialDomRepresentation = await extractDOM(client);
  processedDom = processDom(initialDomRepresentation);
  domRepresentation = initialDomRepresentation;

  // Initialize supervisor's system prompt
  messages.push({
    role: 'system',
    content: `You are a supervisor overseeing an AI assistant that interacts with web pages.

**Objective:**
Assist the user by providing high-level planning and issuing commands to the assistant to interact with web pages.

**Process:**
1. **Plan:** Create a high-level plan based on the user's input.
2. **Execute:** Issue commands to the assistant to perform actions.
3. **Reflect:** Evaluate the results and determine if further actions are needed.

**Instructions:**
- Do not read or include HTML content to conserve context window.
- Communicate with the assistant by issuing one command at a time via function calls.
- Use clear and concise language in commands.
- Preserve the plan/execute/reflect rationale.
`
  });

  // Start interaction
  setupCLI(
    async (input) => {
      // On user input
      if (isProcessing) {
        console.log('Supervisor is processing your previous request. Please wait...');
        return;
      }

      isProcessing = true;
      messages.push({ role: 'user', content: input });
      try {
        const response = await processSupervisorResponse(
          messages,
          client,
          processedDom,
          domRepresentation
        );
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
