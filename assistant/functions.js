import { executeCommand } from '../browser/browser.js';

export async function executeAssistantFunction(name, argsObj, client) {
  if (name === 'click_element') {
    await executeCommand(client, { type: 'click', ...argsObj });
  } else if (name === 'enter_text') {
    await executeCommand(client, { type: 'input', ...argsObj });
  } else if (name === 'goto_url') {
    await executeCommand(client, { type: 'goto', ...argsObj });
  } else if (name === 'select_option') {
    await executeCommand(client, { type: 'select', ...argsObj });
  } else if (name === 'return_result') {
    // Function to signal task completion and return data
    return argsObj;
  }
}

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
      name: 'return_result',
      description: 'Signal task completion and return the result to the supervisor',
      parameters: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Indicates if the task was successful',
          },
          message: {
            type: 'string',
            description: 'A message describing the task outcome',
          },
          data: {
            type: 'object',
            description: 'Additional data or results from the task',
          },
        },
        required: ['success', 'message'],
      },
    },
  ];
