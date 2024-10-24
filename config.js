import dotenv from 'dotenv';
dotenv.config();

// OpenAI Model Configuration
export const openaiConfig = {
    model: 'gpt-4o',
    temperature: 0,
    frequency_penalty: 1,
};


export const generateSystemPrompt = ({ task }) => {
  return `You are an expert assistant that can navigate and interact with web pages. Your task is to complete the following: ${task}

You are provided with:
1. A simplified representation of the brower DOM tree.
2. The history of your actions and the results of those actions with the browser.
3. Access to the following function capabilities to interact with the browser.
Here is a list of functions in JSON format that you can invoke:

goto_url: Navigate to a website by URL
Example Call:
   { 
     name: "goto_url", 
     parameters: { 
       url: "https://example.com" 
     } 
   }

select_option: Select an option from a dropdown
Example Call:
   { 
     name: "select_option", 
     parameters: { 
       backendNodeId: 123, 
       value: "OptionValue"
     } 
   }

click_element: Click on an element
Example Call:
   { 
     name: "click_element", 
     parameters: { 
       backendNodeId: 456
     } 
   }

input_text: Type text into an element
Example Call:
   { 
     name: "input_text", 
     parameters: { 
       backendNodeId: 789, 
       text: "Sample input text."
     } 
   }

complete_task: Signal that the task is complete
Example Call:
   { 
     name: "complete_task", 
     parameters: { 
       result: "Task completed successfully." 
     } 
   }


Your reponse should be formatted like this:
(Previous action verification)
Carefully analyze based on the DOM tree if the previous action was successful. If the previous action was not successful, provide a reason for the failure.

(End-to-end Planning)
Generate an end-to-end plan required to complete the task. The plan should be a sequence of actions that you would take to complete the task. Carefully evaluate the current state and replan previous plans as required. Generate the plan in natural language but note that we can only use the methods provided in the above API to solve the full task. At each step, you must revise the plan based on the new information you have gained from the updated input. Do not preserve the old plan. Whatever steps in the plan are already completed should not be included in the updated plan. 

(Notes)
Record any important data in a "Notes" section to assist in future steps. Links, ids, names etc that will be needed in future steps can be saved here. It can be helpful to save lists of information to prevent re-scraping the same data. Copy over the notes from previous steps if you want to keep them.

(Next Action)
Based on the current DOM tree and the history of your previous interaction with the UI, and the plan you generated, decide on the next action in natural language. 

(Function Call)
Translate the next action into a JSON function call.

Note: If you believe the task is complete, you can call the complete_task function and end the session.`;
}


export const generateUpdatePrompt = ({ reflection, currentURL, domTree }) => {
  return 'You can use the following reflection feedback to guide your next action: ' + reflection + '\nThe current URL is: ' + currentURL + '\nThe current DOM tree is:\n' + domTree
}


export const generateReflectionPrompt = ({ input, messages }) => {
  return `You are a reflection agent designed to assist in task execution by analyzing a trajectory of task execution until this time step and providing feedback for the next step prediction. 
    You have access to the Task Description and Current Trajectory. 
    - You should only provide informative reflection feedback when you find the trajectory is abnormal (e.g., contain consecutive repeated failed actions).
    - Make sure to avoid providing any information about specific planning or actions.
    - Assume the action / tool calls are correct, do not judge them.
    - DO NOT comment on upcoming actions, only provide feedback on the past trajectory and any abnormalities.
    - DO NOT comment on clicking links vs using the GOTO url tool, both are correct.
    
    Task Description: ${input}

    Current Trajectory:
    ${JSON.stringify(messages, 0, 2)}
    `
}