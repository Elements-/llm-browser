import { generateSummary } from '../config.js';

// Function to reduce repeating blocks in messages
export function redactOldDomContents(messages) {
    // Find the indices of all function response messages (DOM contents)
    const functionResponseIndices = [];
    for (let j = 0; j < messages.length; j++) {
        if (messages[j].role === 'function' && messages[j].name && messages[j].content) {
            functionResponseIndices.push(j);
        }
    }

    if (functionResponseIndices.length < 2) {
        // Not enough function responses or summary completed
        return messages;
    }

    for(let i of functionResponseIndices) {
        if(i == functionResponseIndices[functionResponseIndices.length - 1]) continue;

        const cycleMessages = messages.slice(i - 4, i + 3);
        const summaryMessage = summarizeCycle(cycleMessages);
        messages.splice(i - 4, cycleMessages.length, summaryMessage);
    }

    return redactOldDomContents(messages)
}


// Helper function to summarize a cycle
function summarizeCycle(cycleMessages) {
    const [
        planPrompt,
        planResponse,
        executePrompt,
        actionResponse,
        functionResult,
        reflectPrompt,
        reflectResponse,
    ] = cycleMessages;

    // Extract the URL from the functionResult content
    let url = '';
    if (functionResult && functionResult.content) {
        const urlMatch = functionResult.content.match(/The current URL is: (.*)/);
        if (urlMatch && urlMatch[1]) {
            url = urlMatch[1].trim();
        }
    }

    // Generate a summary message for the cycle
    console.log(executePrompt)
    const summaryMessage = {
        role: 'assistant',
        content: generateSummary(actionResponse, reflectResponse, url),
    };

    return summaryMessage;
}
