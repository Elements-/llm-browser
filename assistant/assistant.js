import { openaiClient } from '../api/openaiClient.js';
import { assistantFunctions, executeAssistantFunction } from './functions.js';
import { extractDOM } from '../browser/domExtractor.js';
import { processDom } from '../browser/domProcessor.js';
import { computeGitDiff } from '../browser/domComparator.js';
import fs from 'fs';
import { redactOldDomContents } from '../utils/redactOldDomContents.js';

// Function to process assistant's response
export async function processAssistantResponse(
  messages,
  client,
  processedDom,
  domRepresentation,
  response_format = null,
  step = 'plan'
) {
  // Redact old DOM contents to save context length
  redactOldDomContents(messages);

  // Prepare the assistant's prompt based on the current step
  let assistantPrompt = '';
  if (step === 'plan') {
    assistantPrompt = 'Please provide a detailed plan to accomplish the supervisor\'s instruction.';
  } else if (step === 'execute') {
    assistantPrompt = 'Proceed to execute the planned actions step-by-step.';
  } else if (step === 'reflect') {
    assistantPrompt = 'Reflect on the executed actions and determine if further actions are needed. If the task is complete, ensure you have called the "return_result" function with the appropriate data.';
  }

  // Add the assistant prompt to messages
  messages.push({
    role: 'system',
    content: assistantPrompt
  });

  if (!response_format) {
    response_format = {
      type: "json_schema",
      json_schema: {
        name: "assistant_default_response",
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
          required: ["success", "message"],
          additionalProperties: true,
        },
      },
    };
  }

  // OpenAI API call with function calling and response format
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: messages,
    functions: assistantFunctions,
    function_call: step === 'execute' ? 'auto' : 'none', // Prevent function calls during plan and reflect
    temperature: 0.2,
  });

  const aiMessage = response.choices[0].message;

  // Prevent function calls during plan or reflect steps
  if ((step === 'plan' || step === 'reflect') && aiMessage.function_call) {
    console.log(`Warning: Assistant attempted to perform an action during the ${step.toUpperCase()} step. This action will be ignored.`);
    // Ignore the function call
    aiMessage.function_call = null;
  }

  messages.push(aiMessage);

  if (step === 'plan') {
    // Proceed to execution
    printDebugInfo(messages);
    return await processAssistantResponse(
      messages,
      client,
      processedDom,
      domRepresentation,
      response_format,
      'execute'
    );
  } else if (step === 'execute') {
    if (aiMessage.function_call) {
      const { name, arguments: args } = aiMessage.function_call;
      let argsObj = {};
      try {
        argsObj = JSON.parse(args);
      } catch (err) {
        console.error('Error parsing function arguments:', err);
        return { processedDom, domRepresentation };
      }

      if (name === 'return_result') {
        // Assistant signals task completion
        messages.push({
          role: 'function',
          name: name,
          content: JSON.stringify(argsObj),
        });

        // Return the result to the supervisor
        return {
          processedDom,
          domRepresentation,
          data: argsObj,
        };
      } else {
        // Handle other function calls
        await executeAssistantFunction(name, argsObj, client);

        // Re-extract and process the DOM after executing the function
        const newDomRepresentation = await extractDOM(client);
        const newProcessedDom = processDom(newDomRepresentation);

        // Compute differences if needed
        const { differencePercentage, diffText, changedLines } = computeGitDiff(processedDom, newProcessedDom);

        // Prepare function result message
        let functionContent;
        if (differencePercentage === 0) {
          functionContent = `Command executed but the DOM had NO CHANGES.
The current DOM content is:
${newProcessedDom}`;
        } else if (differencePercentage < 25 && (changedLines < 100 || differencePercentage < 5)) {
          functionContent = `Command executed and the DOM updated with small changes.
Git Diff:
${diffText}

The current DOM content is:
${newProcessedDom}`;
        } else {
          functionContent = `Command executed and the DOM updated.
The current DOM content is:
${newProcessedDom}`;
        }

        messages.push({
          role: 'function',
          name: name,
          content: functionContent,
        });

        // Update DOM representations
        processedDom = newProcessedDom;
        domRepresentation = newDomRepresentation;

        // Continue execution until the assistant calls 'return_result'
        return await processAssistantResponse(
          messages,
          client,
          processedDom,
          domRepresentation,
          response_format,
          'execute'
        );
      }
    } else {
      // Assistant did not perform any function calls during execute
      console.log('Assistant did not perform any actions during the EXECUTE step.');
      // Proceed to reflection to determine next steps
      return await processAssistantResponse(
        messages,
        client,
        processedDom,
        domRepresentation,
        response_format,
        'reflect'
      );
    }
  } else if (step === 'reflect') {
    printDebugInfo(messages);

    // Check if the assistant has called 'return_result' in previous steps
    const hasReturnedResult = messages.some(msg => msg.role === 'function' && msg.name === 'return_result');

    if (!hasReturnedResult) {
      // Need to adjust the plan, loop back to planning
      return await processAssistantResponse(
        messages,
        client,
        processedDom,
        domRepresentation,
        response_format,
        'plan'
      );
    } else {
      // Task completed, extract the data from 'return_result'
      const returnResultMessage = messages.find(msg => msg.role === 'function' && msg.name === 'return_result');
      let assistantData = null;
      if (returnResultMessage) {
        try {
          assistantData = JSON.parse(returnResultMessage.content);
        } catch (err) {
          console.error('Error parsing assistant return_result:', err);
        }
      }

      return {
        processedDom,
        domRepresentation,
        data: assistantData,
      };
    }
  }

  // Store updated DOM representations
  messages.latestProcessedDom = processedDom;
  messages.latestDomRepresentation = domRepresentation;

  // Return the updated processedDom and domRepresentation
  return { processedDom, domRepresentation };
}

async function printDebugInfo(messages) {
  let function_messages = messages.filter(m => m.role === 'function');
  fs.writeFileSync('dom_content.txt', function_messages[function_messages.length - 1]?.content || '');
  fs.writeFileSync('messages.json', JSON.stringify(messages, null, 2));
}
