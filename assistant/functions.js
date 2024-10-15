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
          description: {
            type: 'string',
            description: 'A brief description of the element being clicked',
          },
        },
        required: ['backendNodeId', 'description'],
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
          description: {
            type: 'string',
            description: 'A brief description of the input element',
          },
        },
        required: ['backendNodeId', 'text', 'description'],
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
  ];