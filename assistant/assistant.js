import { openaiClient } from '../api/openaiClient.js';
import { assistantFunctions, executeAssistantFunction } from './functions.js';
import { extractDOM } from '../browser/domExtractor.js';
import { processDom } from '../browser/domProcessor.js';
import { computeGitDiff } from '../browser/domComparator.js';
import fs from 'fs';
import { redactOldDomContents } from '../utils/redactOldDomContents.js';

// Function to process assistant's response
export async function processAssistantResponse(messages, client, processedDom, domRepresentation, step = 'plan') {
  // Redact old DOM contents to save context length
  redactOldDomContents(messages);

  // Prepare the assistant's prompt based on the current step
  let assistantPrompt = '';
  if (step === 'plan') {
    assistantPrompt = 'Please provide a detailed plan to accomplish the user\'s instruction.';
  } else if (step === 'execute') {
    assistantPrompt = 'Proceed to execute the planned actions step-by-step.';
  } else if (step === 'reflect') {
    assistantPrompt = 'Reflect on the executed actions and determine if the task was completed successfully and note any issues. Adjust the plan if necessary.';
  }

  // Add the assistant prompt to messages
  messages.push({
    role: 'system',
    content: assistantPrompt
  });

  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: messages,
    functions: assistantFunctions,
    function_call: step === 'execute' ? 'auto' : 'none', // Prevent function calls during plan and reflect
    temperature: 0.01,
    frequency_penalty: 1
  });

  const aiMessage = response.choices[0].message;

  // Ensure the assistant doesn't perform actions during plan or reflect
  if ((step === 'plan' || step === 'reflect') && aiMessage.function_call) {
    // Ignore any function calls during plan or reflect
    console.log(`Warning: Assistant attempted to perform an action during the ${step.toUpperCase()} step. This action will be ignored.`);
    aiMessage.function_call = null;
  }

  messages.push(aiMessage);

  // Log context size and messages after receiving response
  console.log(`\n--- After OpenAI API Call (${step.toUpperCase()} Step) ---`);
  console.log(`Prompt tokens: ${response.usage.prompt_tokens}`);

  if (step === 'plan') {
    // Proceed to execution
    printDebugInfo(messages);
    return await processAssistantResponse(
      messages,
      client,
      processedDom,
      domRepresentation,
      'execute'
    );
  } else if (step === 'execute') {
    if (aiMessage.function_call) {
      // Assistant called a function during the execute step
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
      const newDomRepresentation = await extractDOM(client);
      console.log('DOM Extraction Complete');

      // Process the new DOM representation into text
      const newProcessedDom = processDom(newDomRepresentation);
      console.log('DOM Processing Complete');

      // Now compute the difference percentage
      const { differencePercentage, diffText, changedLines } = computeGitDiff(processedDom, newProcessedDom);
      console.log(`Difference Percentage: ${differencePercentage}%`);

      // Prepare function result message based on the change
      let functionContent;
      if (differencePercentage === 0) {
        functionContent = `Command executed but the DOM had NO CHANGES.
The current DOM content is:
${newProcessedDom}
`;
      } else if (differencePercentage < 25 && (changedLines < 100 || differencePercentage < 5)) {
        functionContent = `Command executed and the DOM updated with small changes.
First is a git diff format of the small changes on the page, which may indicate something like a dropdown selection, popup, or alert. Your previous action likely yielded these changes.
Git Diff:
${diffText}

The current DOM content is:
${newProcessedDom}
`;
      } else {
        functionContent = `Command executed and the DOM updated.
The current DOM content is:
${newProcessedDom}
`;
      }

      messages.push({
        role: 'function',
        name: name,
        content: functionContent,
      });

      // Update processedDom and domRepresentation for the next iteration
      processedDom = newProcessedDom;
      domRepresentation = newDomRepresentation;

      printDebugInfo(messages);

      // Proceed to reflection
      return await processAssistantResponse(
        messages,
        client,
        processedDom,
        domRepresentation,
        'reflect'
      );
    } else {
      // Assistant didn't call any function during execute
      console.log('Assistant did not perform any actions during the EXECUTE step.');
      return { processedDom, domRepresentation };
    }
  } else if (step === 'reflect') {
    printDebugInfo(messages);

    // Determine if the assistant wants to adjust the plan or proceed
    const reflection = aiMessage.content.toLowerCase();
    const needsAdjustment = reflection.includes('adjust') || reflection.includes('need to') || reflection.includes('next steps');

    if (needsAdjustment) {
      // Assistant needs to adjust the plan
      return await processAssistantResponse(
        messages,
        client,
        processedDom,
        domRepresentation,
        'plan'
      );
    } else {
      // Task completed or proceed to execute again
      // Decide whether to stop or continue; for now, we'll proceed to execution
      return await processAssistantResponse(
        messages,
        client,
        processedDom,
        domRepresentation,
        'execute'
      );
    }
  }
}

async function printDebugInfo(messages) {
  let function_messages = messages.filter(m => m.role === 'function');
  fs.writeFileSync('dom_content.txt', function_messages[function_messages.length - 1]?.content || '');
  fs.writeFileSync('messages.json', JSON.stringify(messages, null, 2));
}
