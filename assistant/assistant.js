import { openaiClient } from '../api/openaiClient.js';
import { executeAssistantFunction } from './functions.js';
import { extractDOM } from '../browser/domExtractor.js';
import { processDom } from '../browser/domProcessor.js';
import { logMessages } from '../utils/logger.js';
import {
  generateUpdatePrompt,
  generateReflectionPrompt,
  openaiConfig
} from '../config.js';

// Function to process assistant's response
export async function processAssistantResponse(input, messages, client, processedDom, domRepresentation) {
  const response = await openaiClient.chat.completions.create({
    model: openaiConfig.model,
    messages: messages,
    temperature: openaiConfig.temperature,
    frequency_penalty: openaiConfig.frequency_penalty,
  });

  const aiMessage = response.choices[0].message;
  messages.push(aiMessage);

  console.log(aiMessage.content)

  // Log context size and messages after receiving response
  console.log(`Prompt tokens: ${response.usage.prompt_tokens}`);

  let function_call

  try {
    // Extract function call JSON from aiMessage.content
    const functionCallMatch = aiMessage.content.match(/```json\s*\n([\s\S]*?)\n```/);
    if (functionCallMatch) {
      const functionCallJSON = functionCallMatch[1];
      const functionCall = JSON.parse(functionCallJSON);
      function_call = {
        name: functionCall.name,
        arguments: JSON.stringify(functionCall.parameters),
      };
    }
  } catch (error) {
    console.error('Error extracting function call:', error);
  }

  if (function_call) {
    const { name, arguments: args } = function_call;
    let argsObj = {};
    try {
      argsObj = JSON.parse(args);
    } catch (err) {
      console.error('Error parsing function arguments:', err);
      return { processedDom, domRepresentation };
    }

    // If the assistant called 'complete_task', end the flow
    if (name === 'complete_task') {
      return { processedDom, domRepresentation };
    }

    // Execute the function
    await executeAssistantFunction(name, argsObj, client);

    // After executing the function, re-extract and process the DOM
    const { domData: newDomRepresentation, currentURL } = await extractDOM(client);

    // Process the new DOM representation into text
    const newProcessedDom = processDom(newDomRepresentation);

    // Update processedDom and domRepresentation for the next iteration
    processedDom = newProcessedDom;
    domRepresentation = newDomRepresentation;

    if(messages.length > 2) {
      let potentialSystemPrompt = messages[messages.length - 2].content;
      if(potentialSystemPrompt.includes('The current DOM tree is:')) {
        messages.splice(messages.length - 2, 1);
      }
    }

    let reflection = await doReflection(input, messages);

    messages.push({
      role: 'system',
      content: generateUpdatePrompt({ reflection, currentURL, processedDom })
    });

    logMessages(messages);

    return processAssistantResponse(input, messages, client, processedDom, domRepresentation);
  }
  return { processedDom, domRepresentation };
}

const doReflection = async (input, messages) => {
  let prompt = generateReflectionPrompt({ input, messages });

  const response = await openaiClient.chat.completions.create({
    model: openaiConfig.model,
    messages: [
      { role: 'system', content: prompt },
    ],
    temperature: openaiConfig.temperature,
    frequency_penalty: openaiConfig.frequency_penalty,
  });
  
  return response.choices[0].message.content
}
