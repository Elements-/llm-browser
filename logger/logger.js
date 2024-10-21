import fs from 'fs';

let logContent = '';

export function logSupervisorInteraction(step, supervisorMessage) {
  const simplifiedStep = step.charAt(0).toUpperCase() + step.slice(1);
  // Simplify system messages
  if (supervisorMessage.role === 'system') {
    logContent += `\n=== System (${simplifiedStep} Instructions) ===\n`;
  } else if (supervisorMessage.role === 'assistant' && supervisorMessage.content) {
    logContent += `\nSupervisor (${simplifiedStep}): ${supervisorMessage.content}\n`;
  } else if (supervisorMessage.function_call) {
    logContent += `\nSupervisor (${simplifiedStep}) called function '${supervisorMessage.function_call.name}' with arguments:\n${supervisorMessage.function_call.arguments}\n`;
  }
  // Write the log to a file
  fs.writeFileSync('interaction_log.txt', logContent);
}

export function logAssistantInteraction(step, assistantMessages) {
  // Nested/indented sublog for assistant execution
  let assistantLog = '\n  --- Assistant Interaction ---\n';
  assistantMessages.forEach(msg => {
    if (msg.role === 'system') {
      assistantLog += '    [System Message]\n';
    } else if (msg.role === 'assistant' && msg.content) {
      assistantLog += `    Assistant: ${msg.content}\n`;
    } else if (msg.role === 'user') {
      assistantLog += `    User: ${msg.content}\n`;
    } else if (msg.role === 'function' && msg.name !== 'return_result') {
      assistantLog += `    Function '${msg.name}' executed with result:\n      ${msg.content}\n`;
    } else if (msg.role === 'function' && msg.name === 'return_result') {
      assistantLog += `    Assistant completed task with result:\n      ${msg.content}\n`;
    }
  });
  assistantLog += '  --- End of Assistant Interaction ---\n';

  // Append to the log content
  logContent += assistantLog;

  // Write the log to a file
  fs.writeFileSync('interaction_log.txt', logContent);
}
