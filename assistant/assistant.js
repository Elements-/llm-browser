import { openaiClient } from '../api/openaiClient.js';
import { assistantFunctions } from './functions.js';
import { executeCommand } from '../browser/browser.js';
import { getDOMRepresentation } from '../browser/domExtractor.js';
import { processDom } from '../browser/domProcessor.js';

// Function to process assistant's response
export async function processAssistantResponse(messages, client, processedDom) {
  // Before sending the request, redact old DOM contents to save context length
  redactOldDomContents(messages);

  console.log(messages)

  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: messages,
    functions: assistantFunctions,
    function_call: 'auto',
  });

  const aiMessage = response.choices[0].message;
  messages.push(aiMessage);

  // Log context size and messages after receiving response
  console.log('\n--- After OpenAI API Call ---');
  console.log(`Prompt tokens: ${response.usage.prompt_tokens}`);

  if (aiMessage.function_call) {
    // Assistant called a function
    const { name, arguments: args } = aiMessage.function_call;
    let argsObj = {};
    try {
      argsObj = JSON.parse(args);
    } catch (err) {
      console.error('Error parsing function arguments:', err);
      return processedDom;
    }

    // Execute the function
    await executeAssistantFunction(name, argsObj, client);

    // After executing the function, re-extract and process the DOM
    const newDomRepresentation = await getDOMRepresentation(client);
    const newProcessedDom = processDom(newDomRepresentation);

    // Include the updated DOM in the function response
    messages.push({
      role: 'function',
      name: name,
      content: `Command executed and DOM updated.
The current DOM content is:
${newProcessedDom}
`,
    });

    // Recursive call to process assistant's response
    return await processAssistantResponse(messages, client, newProcessedDom); // Return the updated processedDom
  } else {
    // Assistant provided a response
    console.log('Assistant:', aiMessage.content);
    return processedDom; // Return the current processedDom
  }
}

// Function to execute assistant's function call
async function executeAssistantFunction(name, argsObj, client) {
  if (name === 'click_element') {
    await executeCommand(client, { type: 'click', nodeId: argsObj.nodeId });
  } else if (name === 'enter_text') {
    await executeCommand(client, { type: 'input', nodeId: argsObj.nodeId, text: argsObj.text });
  } else if (name === 'goto_url') {
    await executeCommand(client, { type: 'goto', url: argsObj.url });
  }
}

// Function to redact old DOM contents from previous messages
function redactOldDomContents(messages) {
  // Keep the latest function response with DOM content, redact others
  let foundLatestDom = false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      (msg.role === 'function' || msg.role === 'system') &&
      msg.content &&
      msg.content.includes('The current DOM content is:')
    ) {
      if (!foundLatestDom) {
        // This is the latest message with DOM content, keep it
        foundLatestDom = true;
      } else {
        // Redact DOM content from this message
        const splitContent = msg.content.split('The current DOM content is:');
        if (splitContent.length > 1) {
          msg.content = `${splitContent[0]}The current DOM content is: [DOM content redacted]`;
        }
      }
    }
  }
}

// Function to initialize the system prompt with the initial DOM
export function initializeSystemPrompt(processedDom) {
  const systemPrompt = `You are an AI assistant interacting with web pages. You can click elements, enter text into inputs, or navigate to URL with the included functions.

You should never ask the user to click a button or do something that you can do yourself. Always go as far as you can with the instructions you are given.

The current DOM content is:
${processedDom}
`;
  // Return the system message
  return { role: 'system', content: systemPrompt };
}