import { openaiClient } from '../api/openaiClient.js';
import { executeAssistantFunction } from './functions.js';
import { extractDOM } from '../browser/domExtractor.js';
import { logMessages } from '../utils/logger.js';
import {
  generateUpdatePrompt,
  generateReflectionPrompt,
  openaiConfig,
  generateInjectedReflectionPrompt,
  generateFinalReflectionPrompt,
  generateInjectedFinalReflectionPrompt,
} from '../config.js';

// Function to process assistant's response
export async function processAssistantResponse(input, messages, client, domTree) {
  console.log('\n' + ('='.repeat(20)) + '\n')

  const response = await openaiClient.chat.completions.create({
    model: openaiConfig.model,
    messages: messages,
    temperature: openaiConfig.temperature,
    frequency_penalty: openaiConfig.frequency_penalty,
  });

  const aiMessage = response.choices[0].message;
  messages.push(aiMessage);

  console.log(`Prompt tokens: ${response.usage.prompt_tokens}`);
  console.log('MODEL RESPONSE\n' + aiMessage.content)

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

    messages.push({
      role: 'system',
      content: 'MALFORMED JSON FUNCTION CALL. TRY AGAIN.'
    });
    return processAssistantResponse(input, messages, client, domTree);
  }

  if(!function_call) {
    messages.push({
      role: 'system',
      content: 'A function call was expected but not found. Try again.'
    });
    return processAssistantResponse(input, messages, client, domTree);
  }
  else{
    const { name, arguments: args } = function_call;
    let argsObj = {};
    try {
      argsObj = JSON.parse(args);
    } catch (err) {
      console.error('Error parsing function arguments:', err);
      return { domTree };
    }

    // If the assistant called 'complete_task', end the flow
    if (name === 'complete_task') {
      let { finalReflection, success } = await doFinalReflection(input, messages);
      if(success) {
        return { domTree, finalReflection, success };
      }
      
      // If the task is not complete, inject failure message
      messages.push({
        role: 'system',
        content: generateInjectedFinalReflectionPrompt({ finalReflection })
      });
      return processAssistantResponse(input, messages, client, domTree);
    }

    // Execute the function
    await executeAssistantFunction(name, argsObj, client);

    // After executing the function, re-extract and process the DOM
    const { domTree: newDomTree, currentURL } = await extractDOM(client);
    domTree = newDomTree;

    // Remove the last system prompt if it has the DOM tree
    for(let i in  messages) {
      let potentialSystemPrompt = messages[i]
      if(potentialSystemPrompt.content.indexOf('The current URL is:') === 0) {
        messages.splice(i, 1);
      }
    }

    let reflection = await doReflection(input, messages);

    messages.push({
      role: 'system',
      content: generateInjectedReflectionPrompt({ reflection })
    });

    messages.push({
      role: 'system',
      content: generateUpdatePrompt({ currentURL, domTree })
    });

    logMessages(messages);

    return processAssistantResponse(input, messages, client, domTree);
  }
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
  
  console.log(`Reflection Prompt tokens: ${response.usage.prompt_tokens}`)
  console.log('REFLECTION RESPONSE\n' + response.choices[0].message.content)

  return response.choices[0].message.content
}

const doFinalReflection = async (input, messages) => {
  let prompt = generateFinalReflectionPrompt({ input, messages });

  const response = await openaiClient.chat.completions.create({
    model: openaiConfig.model,
    messages: [
      { role: 'system', content: prompt },
    ],
    temperature: openaiConfig.temperature,
    frequency_penalty: openaiConfig.frequency_penalty,
  });
  
  console.log(`Final Reflection Prompt tokens: ${response.usage.prompt_tokens}`)
  console.log('FINAL REFLECTION RESPONSE\n' + response.choices[0].message.content)

  const successPattern = /\(Task Completion Verification\)\s*(SUCCESS|FAILURE)/;
  const match = response.choices[0].message.content.match(successPattern);
  console.log('match', match);
  const success = match && match[1] === 'SUCCESS';

  return { finalReflection: response.choices[0].message.content, success };
}


