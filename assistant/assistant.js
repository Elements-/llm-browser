import { openaiClient } from '../api/openaiClient.js';
import { assistantFunctions } from './functions.js';
import { executeCommand } from '../browser/browser.js';
import { getDOMRepresentation } from '../browser/domExtractor.js';
import { processDom } from '../browser/domProcessor.js';
import { computeGitDiff } from '../browser/domComparator.js';
import fs from 'fs';

// Function to process assistant's response
export async function processAssistantResponse(messages, client, processedDom, domRepresentation) {
  // Redact old DOM contents to save context length
  redactOldDomContents(messages);
  console.log(messages)
  fs.writeFileSync('messages.txt', messages[messages.length - 1].content);

  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: messages,
    functions: assistantFunctions,
    function_call: 'auto',
    temperature: 0.2,
    frequency_penalty: 1
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
      return { processedDom, domRepresentation };
    }

    // Execute the function
    await executeAssistantFunction(name, argsObj, client);

    // After executing the function, re-extract and process the DOM
    const newDomRepresentation = await getDOMRepresentation(client);
    console.log('DOM Extraction Complete')

    // Process the new DOM representation into text
    const newProcessedDom = processDom(newDomRepresentation);
    console.log('DOM Processing Complete')

    // Now compute the difference percentage
    const { differencePercentage, diffText, changedLines } = computeGitDiff(processedDom, newProcessedDom);
    console.log(`Difference Percentage: ${differencePercentage}%`);

    if(differencePercentage === 0) {
      messages.push({
        role: 'function',
        name: name,
        content: `Command executed and DOM had NO CHANGES.
The current DOM content is:
${newProcessedDom}
`,
      });
    }
    else if (differencePercentage < 25 && (changedLines < 100 || differencePercentage < 5)) {
      // Include the updated DOM in the function response with adjusted prompt
      messages.push({
        role: 'function',
        name: name,
        content: `Command executed and DOM updated with small changes.
First is a git diff format of the small changes on the page, this may indicate something like a dropdown selection, popup, or alert. Your previous likely yielded these changes.
Git Diff:
${diffText}

The current DOM content is:
${newProcessedDom}
`,
      });
    }
    else {
      // Include the updated DOM in the function response without annotation
      messages.push({
        role: 'function',
        name: name,
        content: `Command executed and DOM updated.
The current DOM content is:
${newProcessedDom}
`,
      });
    }

    // Update processedDom and domRepresentation for the next iteration
    processedDom = newProcessedDom;
    domRepresentation = newDomRepresentation;

    // Recursive call to process assistant's response
    return await processAssistantResponse(
      messages,
      client,
      processedDom,
      domRepresentation
    );
  } else {
    // Assistant provided a response
    console.log('Assistant:', aiMessage.content);
    return { processedDom, domRepresentation };
  }
}

// Function to execute assistant's function call
async function executeAssistantFunction(name, argsObj, client) {
  if (name === 'click_element') {
    await executeCommand(client, { type: 'click', ...argsObj });
  } else if (name === 'enter_text') {
    await executeCommand(client, { type: 'input', ...argsObj });
  } else if (name === 'goto_url') {
    await executeCommand(client, { type: 'goto', ...argsObj });
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
          msg.content = `Command executed and DOM updated: [DOM content redacted]`;
        }
      }
    }
  }
}

// Function to initialize the system prompt with the initial DOM
export function initializeSystemPrompt(processedDom) {
  const systemPrompt = `You are an AI assistant interacting with web pages.

**Capabilities:**
- Click elements.
- Enter text into inputs.
- Navigate to URLs.

**Guidelines:**
- **Avoid repeating actions** on the same element unless necessary due to a change in the page state.
- Be aware that some elements (like dropdowns or popups) may require follow-up actions.
- If an action doesn't yield the expected result, try a different approach without excessive repetition.
- Keep track of your actions to prevent getting stuck or looping over the same steps.
- Aim to accomplish tasks efficiently and effectively.

**Objective:**
Assist the user in navigating and interacting with web pages by following these guidelines.
`;
  // Return the system message
  return { role: 'system', content: systemPrompt };
}
