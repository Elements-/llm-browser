import { processAssistantResponse } from '../assistant/assistant.js';
import { logAssistantInteraction } from '../logger/logger.js';

export const supervisorFunctions = [
  {
    name: 'call_assistant',
    description: 'Call the assistant with a command to perform and define expected response structure',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The command or instruction for the assistant to execute',
        },
        response_format: {
          type: 'object',
          description: 'JSON schema defining the expected assistant response',
        },
      },
      required: ['command', 'response_format'],
    },
  },
];

export async function executeSupervisorFunction(
  name,
  argsObj,
  messages,
  client,
  processedDom,
  domRepresentation
) {
  if (name === 'call_assistant') {
    const { command, response_format } = argsObj;

    // Assistant's system prompt
    const assistantPrompt = `You are an AI assistant interacting with web pages.

**Capabilities:**
- Click elements.
- Enter text into inputs.
- Navigate to URLs.

**Guidelines:**
- Avoid repeating actions on the same element unless necessary due to a change in the page state.
- Be aware that some elements (like dropdowns or popups) may require follow-up actions.
- If an action doesn't yield the expected result, adjust your plan accordingly without excessive repetition.
- Keep track of your actions to prevent getting stuck or looping over the same steps.
- When handling lists (e.g., invoices), always sort or filter to identify the most recent item before interacting.

**Three-Step Process:**
1. **Plan:** Before performing any actions, outline the steps needed to accomplish the task. *Do not execute any actions in this step.*
2. **Execute:** Carry out the planned actions step-by-step. Use function calls to perform actions.
3. **Reflect:** After execution, verify if the task was completed successfully and note any issues. Adjust the plan if necessary. *Do not execute any actions in this step.*

**Instructions:**
- Prefix each response with the current step (e.g., "**Plan:**", "**Execute:**", "**Reflect:**").
- After providing the plan, proceed to execution without waiting for user confirmation.
- Do not perform any actions during the Plan or Reflect steps.
- When the task is completed, call the 'return_result' function with 'success', 'message', and 'data' keys to signal task completion.

**Objective:**
- Assist the user in navigating and interacting with web pages by following these guidelines and the three-step process.
- Execute the command provided by the supervisor.
- Use the provided functions to control a web browser.

Current DOM representation of the browser is:
${processedDom}`;

    // Reset assistant's context
    const assistantMessages = [];

    // Add the assistant's system prompt
    assistantMessages.push({
      role: 'system',
      content: assistantPrompt,
    });

    // Add the command as the user message
    assistantMessages.push({
      role: 'user',
      content: command,
    });

    // Process the assistant's response
    const assistantResponse = await processAssistantResponse(
      assistantMessages,
      client,
      processedDom,
      domRepresentation,
      response_format
    );

    // Log the assistant's interaction
    logAssistantInteraction('execute', assistantMessages);

    // Update DOM after assistant's execution
    processedDom = assistantResponse.processedDom;
    domRepresentation = assistantResponse.domRepresentation;

    // Save important data in supervisor's context if needed
    if (assistantResponse.data) {
      messages.push({
        role: 'assistant',
        content: `Data received from assistant: ${JSON.stringify(assistantResponse.data)}`,
      });
    }

    return {
      processedDom,
      domRepresentation,
      data: assistantResponse.data,
    };
  }
}
