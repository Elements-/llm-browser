// Function to redact old DOM contents from previous messages
export function redactOldDomContents(messages) {
    // Keep the latest function response with DOM content, redact others
    let foundLatestDom = false;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (
        (msg.role === 'function' || msg.role === 'system') &&
        msg.content &&
        msg.content.includes('The current DOM content is:')
      ) {
        if (!foundLatestDom) {
          // This is the latest message with DOM content, keep it
          foundLatestDom = true;
        } else {
          // Redact DOM content from this message
          const splitContent = msg.content.split('The current DOM content is:');
          if (splitContent.length > 1) {
            msg.content = `Command executed and DOM updated: [DOM content redacted]`;
          }
        }
      }
    }
  }