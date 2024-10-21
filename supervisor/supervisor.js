import { openaiClient } from '../api/openaiClient.js';
import { supervisorFunctions, executeSupervisorFunction } from './functions.js';
import { redactOldDomContents } from '../utils/redactOldDomContents.js';
import { logSupervisorInteraction } from '../logger/logger.js'; // Import the logger

export async function processSupervisorResponse(
  messages,
  client,
  processedDom,
  domRepresentation,
  plan = [],
  currentStepIndex = 0,
  step = 'plan'
) {
  // Supervisor employs the plan/execute process
  redactOldDomContents(messages);

  // Prepare the supervisor's prompt
  const supervisorPrompt = getSupervisorPrompt(step);
  messages.push({
    role: 'system',
    content: supervisorPrompt,
  });

  // Allow function calls in all steps for flexibility
  const functionCallSetting = 'auto';

  // OpenAI API call with function calling
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o',
    messages: messages,
    functions: supervisorFunctions,
    function_call: functionCallSetting,
    temperature: 0.2,
  });

  const supervisorMessage = response.choices[0].message;

  // Prevent function calls during the planning step
  if (step === 'plan' && supervisorMessage.function_call) {
    console.log(`Warning: Supervisor attempted to perform an action during the PLAN step. This action will be ignored.`);
    supervisorMessage.function_call = null;
  }

  messages.push(supervisorMessage);

  // Log the supervisor's response
  logSupervisorInteraction(step, supervisorMessage);

  if (step === 'plan') {
    // Extract the plan steps from the supervisor's message
    plan = extractPlanSteps(supervisorMessage.content);
    currentStepIndex = 0;
    // Proceed to execution
    return await processSupervisorResponse(
      messages,
      client,
      processedDom,
      domRepresentation,
      plan,
      currentStepIndex,
      'execute'
    );
  } else if (step === 'execute') {
    if (currentStepIndex < plan.length) {
      const currentCommand = plan[currentStepIndex];
      // Supervisor executes the current step by calling the assistant
      const result = await executeCurrentStep(
        currentCommand,
        messages,
        client,
        processedDom,
        domRepresentation
      );

      // Update the DOM and processed DOM if they have changed
      processedDom = result.processedDom || processedDom;
      domRepresentation = result.domRepresentation || domRepresentation;

      // Analyze the result
      // Optionally, you can inspect result.data or other outputs

      // Proceed to the next step
      currentStepIndex += 1;
      return await processSupervisorResponse(
        messages,
        client,
        processedDom,
        domRepresentation,
        plan,
        currentStepIndex,
        'execute'
      );
    } else {
      // All steps completed
      console.log('All steps in the plan have been executed.');
      return { processedDom, domRepresentation };
    }
  }
}

// Helper function to extract plan steps from the supervisor's plan message
function extractPlanSteps(content) {
  // Implement logic to parse the plan steps from content
  // For simplicity, assume the steps are in a list format

  const steps = content.split('\n').filter(line => line.startsWith('-') || line.match(/^\d+\./));
  return steps.map(step => step.replace(/^-|\d+\.\s*/, '').trim());
}

// Function to execute the current step
async function executeCurrentStep(
  command,
  messages,
  client,
  processedDom,
  domRepresentation
) {
  // Supervisor constructs the command for the assistant
  messages.push({
    role: 'assistant',
    content: `Executing step: ${command}`,
  });

  // Call the assistant via the 'call_assistant' function
  const functionCallMessage = {
    role: 'assistant',
    content: null,
    function_call: {
      name: 'call_assistant',
      arguments: JSON.stringify({ command }),
    },
  };

  messages.push(functionCallMessage);

  // Execute the supervisor's function
  const result = await executeSupervisorFunction(
    'call_assistant',
    { command },
    messages,
    client,
    processedDom,
    domRepresentation
  );

  return result;
}

function getSupervisorPrompt(step) {
  switch (step) {
    case 'plan':
      return `As a supervisor, create a high-level plan to accomplish the user's instruction.

- Do NOT include any commands
- Focus on high-level steps
- Be concise in your instructions, breaking down tasks into steps that might take a human 10-20 seconds to complete
`;
    case 'execute':
      return `Proceed to execute the planned actions one by one.

- Include ANY and ALL information that will be needed for the assistant to complete each step.
- Provide commands by calling the 'call_assistant' function.
- Construct commands of moderate context length; avoid micromanaging.
- Request structured information from the assistant as needed, be specific about the information you want from the page and may need in the future.
`;
    default:
      return '';
  }
}
