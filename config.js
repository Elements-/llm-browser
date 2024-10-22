import dotenv from 'dotenv';
dotenv.config();

// OpenAI Model Configuration
export const openaiConfig = {
    model: 'gpt-4o',
    temperature: 0,
    frequency_penalty: 1,
};

// System Prompt
export const systemPrompt = `You are an AI assistant interacting with web pages.

**Capabilities:**
- Click elements.
- Enter text into inputs.
- Navigate to URLs.
- Select options from dropdowns.

**Guidelines:**
- **Avoid repeating actions** on the same element unless necessary due to a change in the page state.
- Be aware that some elements (like dropdowns or popups) may require follow-up actions.
- If an action doesn't yield the expected result, adjust your plan accordingly without excessive repetition.
- Keep track of your actions to prevent getting stuck or looping over the same steps.

**Three-Step Process:**
1. **Plan:** Before performing any actions, outline the steps needed to accomplish the task. *Do not execute any actions in this step.*
2. **Execute:** Carry out the planned actions step-by-step.
3. **Reflect:** After execution, verify if the task was completed successfully and note any issues. Adjust the plan if necessary. *Do not execute any actions in this step.*

**Instructions:**
- Prefix each response with the current step (e.g., "**Plan:**", "**Execute:**", "**Reflect:**").
- After providing the plan, proceed to execution without waiting for user confirmation.
- **Do not perform any actions during the Plan or Reflect steps.**
- After reflection, decide if further actions are needed and adjust accordingly.

**Objective:**
Assist the user in navigating and interacting with web pages by following these guidelines and the three-step process.`;

// Assistant Prompts
export const assistantPrompts = {
  plan: "Please provide a detailed plan to accomplish the user's instruction.",
  execute: 'Proceed to execute the planned actions step-by-step.',
  reflect: 'Reflect on the executed actions and determine if adjustments are needed.',
};

export function generateSummary(actionResponse, reflectResponse, url) {
    return `Previous steps have been summarized for brevity.

**Current URL:** ${url}

**Function Call:**
\`\`\`json
${JSON.stringify(actionResponse.function_call, null, 2)}
\`\`\`

The function call yielded the following reflection:

${reflectResponse.content}`
}

// Function Content Generators
export function generateFunctionContentZeroDifference(currentURL, newProcessedDom) {
  return `Command executed but the DOM had NO CHANGES.
The current URL is: ${currentURL}
The current DOM content is:
${newProcessedDom}
`;
}

export function generateFunctionContentSmallDifference(currentURL, diffText, newProcessedDom) {
  return `Command executed and the DOM updated with small changes.
The current URL is: ${currentURL}
First is a git diff format of the small changes on the page, which may indicate something like a dropdown selection, popup, or alert. Your previous action likely yielded these changes.
Git Diff:
${diffText}

The current DOM content is:
${newProcessedDom}
`;
}

export function generateFunctionContentUpdatedDOM(currentURL, newProcessedDom) {
  return `Command executed and the DOM updated.
The current URL is: ${currentURL}
The current DOM content is:
${newProcessedDom}
`;
}

// Assistant Function Definitions
export const assistantFunctions = [
  {
    name: 'click_element',
    description: 'Click on an element by backendNodeId',
    parameters: {
      type: 'object',
      properties: {
        backendNodeId: {
          type: 'integer',
          description: 'The backendNodeId of the element to click',
        },
        explanation: {
          type: 'string',
          description: 'Reasoning for the action, what it is interacting with, and why',
        },
      },
      required: ['backendNodeId', 'explanation'],
    },
  },
  {
    name: 'enter_text',
    description: 'Enter text into an input element by backendNodeId',
    parameters: {
      type: 'object',
      properties: {
        backendNodeId: {
          type: 'integer',
          description: 'The backendNodeId of the input element',
        },
        text: {
          type: 'string',
          description: 'The text to enter',
        },
        explanation: {
          type: 'string',
          description: 'Reasoning for the action, what it is interacting with, and why',
        },
      },
      required: ['backendNodeId', 'text', 'explanation'],
    },
  },
  {
    name: 'goto_url',
    description: 'Navigate to a website by URL',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'select_option',
    description: 'Select an option from a dropdown by backendNodeId',
    parameters: {
      type: 'object',
      properties: {
        backendNodeId: {
          type: 'integer',
          description: 'The backendNodeId of the select element',
        },
        value: {
          type: 'string',
          description: 'The value attribute of the option to select',
        },
        explanation: {
          type: 'string',
          description: 'Reasoning for the action, what it is interacting with, and why',
        },
      },
      required: ['backendNodeId', 'value', 'explanation'],
    },
  },
  {
    name: 'complete_task',
    description: 'Signals that the assistant has completed the task and provides the final result.',
    parameters: {
      type: 'object',
      properties: {
        result: {
          type: 'string',
          description: 'The final result or message after task completion.',
        },
      },
      required: ['result'],
    },
  },
];