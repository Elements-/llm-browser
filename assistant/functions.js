import { executeCommand } from '../browser/browser.js';
import { assistantFunctions } from '../config.js'; // Import assistantFunctions

export async function executeAssistantFunction(name, argsObj, client) {
  if (name === 'click_element') {
    await executeCommand(client, { type: 'click', ...argsObj });
  } else if (name === 'enter_text') {
    await executeCommand(client, { type: 'input', ...argsObj });
  } else if (name === 'goto_url') {
    await executeCommand(client, { type: 'goto', ...argsObj });
  } else if (name === 'select_option') {
    await executeCommand(client, { type: 'select', ...argsObj });
  } else if (name === 'complete_task') {
    // Handle task completion
    console.log('Task completed. Final result:', argsObj.result);
    process.exit(0); // Exit the program
  }
}
