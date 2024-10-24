import fs from 'fs';

export function logMessages(messages) {
  fs.writeFileSync('./debug/messages.json', JSON.stringify(messages, null, 2));

  // Process messages to format 'content' field
  const processedMessages = messages.map((message) => {
    const newMessage = { ...message };
    if (newMessage.content) {
      // Indent content by 4 spaces on each line
      newMessage.content = newMessage.content
        .split('\n')
        .map((line) => '    ' + line)
        .join('\n');
    }
    return newMessage;
  });

  // Convert messages to JSON string without escaping special characters
  let jsonString = JSON.stringify(processedMessages, null, 2);

  // Replace escaped newline characters in the JSON string with actual newlines
  jsonString = jsonString.replace(/\\n/g, '\n');

  fs.writeFileSync('./debug/messages.json.txt', jsonString);
}
