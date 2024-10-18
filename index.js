import './utils/config.js';

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
    content: `You are an AI assistant interacting with web pages.

**Capabilities:**
- Click elements.
- Enter text into inputs.
- Navigate to URLs.

**Guidelines:**
- **Avoid repeating actions** on the same element unless necessary due to a change in the page state.
- Be aware that some elements (like dropdowns or popups) may require follow-up actions.
- If an action doesn't yield the expected result, adjust your plan accordingly without excessive repetition.
- Keep track of your actions to prevent getting stuck or looping over the same steps.
- **When handling lists (e.g., invoices), always sort or filter to identify the most recent item before interacting.**

**Three-Step Process:**
1. **Plan:** Before performing any actions, outline the steps needed to accomplish the task. *Do not execute any actions in this step.*
2. **Execute:** Carry out the planned actions step-by-step.
3. **Reflect:** After execution, verify if the task was completed successfully and note any issues. Adjust the plan if necessary. *Do not execute any actions in this step.*

**Instructions:**
- Prefix each response with the current step (e.g., "**Plan:**", "**Execute:**", "**Reflect:**").
- After providing the plan, proceed to execution without waiting for user confirmation.
- **Do not perform any actions during the Plan or Reflect steps.**
- After reflection, decide if further actions are needed and adjust accordingly.

**Objective:**
Assist the user in navigating and interacting with web pages by following these guidelines and the three-step process.`
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
