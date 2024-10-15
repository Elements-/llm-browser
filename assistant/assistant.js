import { openaiClient } from '../api/openaiClient.js';
import { assistantFunctions } from './functions.js';
import { executeCommand } from '../browser/browser.js';
import { getDOMRepresentation } from '../browser/domExtractor.js';
import { processDom } from '../browser/domProcessor.js';
import { computeDifferencePercentage, findTextDifferences } from '../browser/domComparator.js';

// Function to process assistant's response
export async function processAssistantResponse(messages, client, processedDom, domRepresentation, idMapping = {}) {
  console.log(messages)
  // Redact old DOM contents to save context length
  redactOldDomContents(messages);

  //console.log(messages);

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
      return { processedDom, domRepresentation, idMapping };
    }

    // Map the nodeId back to the original ID using idMapping
    if (argsObj.nodeId) {
      const originalNodeId = idMapping[argsObj.nodeId];
      if (originalNodeId) {
        argsObj.nodeId = originalNodeId;
      } else {
        console.error('NodeId not found in idMapping:', argsObj.nodeId);
        return { processedDom, domRepresentation, idMapping };
      }
    }

    // Execute the function
    await executeAssistantFunction(name, argsObj, client);

    // After executing the function, re-extract and process the DOM
    const newDomRepresentation = await getDOMRepresentation(client);

    // Process the new DOM representation into text
    const newProcessedDom = processDom(newDomRepresentation);

    // Normalize the IDs in the new processed DOM
    const { newDomString, idMapping: newIdMapping } = normalizeDomIds(newProcessedDom);
    idMapping = newIdMapping;

    // Now compute the difference percentage
    const differencePercentage = computeDifferencePercentage(processedDom, newDomString);
    console.log(`Difference Percentage: ${differencePercentage}%`);

    if (differencePercentage < 25) {
      // Find differences and annotate the new DOM representation
      findTextDifferences(domRepresentation, newDomRepresentation);

      // Re-process the new DOM representation after annotation
      const annotatedProcessedDom = processDom(newDomRepresentation);

      // Normalize the IDs in the annotated processed DOM
      const { newDomString: annotatedDomString, idMapping: annotatedIdMapping } = normalizeDomIds(annotatedProcessedDom);
      idMapping = annotatedIdMapping;

      // Include the updated DOM in the function response with adjusted prompt
      messages.push({
        role: 'function',
        name: name,
        content: `Command executed and DOM updated with small changes.
The *NEW NODE* tags indicate some of the small changes on the page, this may indicate something like a dropdown selection, popup, or alert.
***Your next action is likely related to these new nodes.***
The current DOM content is:
${annotatedDomString}
`,
      });
    } else {
      // Include the updated DOM in the function response without annotation
      messages.push({
        role: 'function',
        name: name,
        content: `Command executed and DOM updated.
The current DOM content is:
${newDomString}
`,
      });
    }

    // Update processedDom and domRepresentation for the next iteration
    processedDom = newDomString;
    domRepresentation = newDomRepresentation;

    // Recursive call to process assistant's response
    console.log('idMapping pass', idMapping)
    return await processAssistantResponse(
      messages,
      client,
      processedDom,
      domRepresentation,
      idMapping
    );
  } else {
    // Assistant provided a response
    console.log('Assistant:', aiMessage.content);
    return { processedDom, domRepresentation, idMapping };
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

// Function to normalize IDs in the DOM representation
function normalizeDomIds(domString) {
  const lines = domString.split('\n');
  let idCounter = 1;
  const idMapping = {};
  const newLines = lines.map(line => {
    return line.replace(/\((\d+)\)/g, (match, p1) => {
      const originalId = parseInt(p1, 10);
      const newId = idCounter++;
      idMapping[newId] = originalId;
      return `(${newId})`;
    });
  });
  const newDomString = newLines.join('\n');
  return { newDomString, idMapping };
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

// At the end of the file
export { normalizeDomIds };
