import { openaiClient } from '../api/openaiClient.js';
import { executeAssistantFunction } from './functions.js';
import { extractDOM } from '../browser/domExtractor.js';
import { processDom } from '../browser/domProcessor.js';
import { computeGitDiff } from '../browser/domComparator.js';
import { redactOldDomContents } from '../utils/redactOldDomContents.js';
import { logMessages } from '../utils/logger.js';
import {
  assistantPrompts,
  openaiConfig,
  assistantFunctions,
  generateFunctionContentZeroDifference,
  generateFunctionContentSmallDifference,
  generateFunctionContentUpdatedDOM,
} from '../config.js';

// Function to process assistant's response
export async function processAssistantResponse(messages, client, processedDom, domRepresentation, step = 'plan') {
  // Redact old DOM contents to save context length
  redactOldDomContents(messages);

  // Prepare the assistant's prompt based on the current step
  const assistantPrompt = assistantPrompts[step];

  // Add the assistant prompt to messages
  messages.push({
    role: 'system',
    content: assistantPrompt,
  });

  const response = await openaiClient.chat.completions.create({
    model: openaiConfig.model,
    messages: messages,
    functions: assistantFunctions,
    function_call: step === 'execute' ? 'auto' : 'none', // Prevent function calls during plan and reflect
    temperature: openaiConfig.temperature,
    frequency_penalty: openaiConfig.frequency_penalty,
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
    logMessages(messages, step);
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

      // If the assistant called 'complete_task', end the flow
      if (name === 'complete_task') {
        return { processedDom, domRepresentation }; // End the flow after task completion
      }

      // After executing the function, re-extract and process the DOM
      const { domData: newDomRepresentation, currentURL } = await extractDOM(client);
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
        functionContent = generateFunctionContentZeroDifference(currentURL, newProcessedDom);
      } else if (differencePercentage < 25 && (changedLines < 100 || differencePercentage < 5)) {
        functionContent = generateFunctionContentSmallDifference(currentURL, diffText, newProcessedDom);
      } else {
        functionContent = generateFunctionContentUpdatedDOM(currentURL, newProcessedDom);
      }

      messages.push({
        role: 'function',
        name: name,
        content: functionContent,
      });

      // Update processedDom and domRepresentation for the next iteration
      processedDom = newProcessedDom;
      domRepresentation = newDomRepresentation;

      logMessages(messages, step);

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
    logMessages(messages, step);

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
      // Proceed to execution again
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
