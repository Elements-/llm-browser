export async function execute(client, command) {
    const { DOM, Input, Runtime } = client;
    const { backendNodeId, text } = command;

    try {
        await DOM.focus({ backendNodeId });

        // Clear the input first
        const { object: { objectId } } = await DOM.resolveNode({ backendNodeId });
        await Runtime.callFunctionOn({
            objectId: objectId,
            functionDeclaration: `function() { this.value = ''; }`,
            returnByValue: true,
            awaitPromise: true,
        });

        for (const char of text) {
            const isUpperCase = char === char.toUpperCase() && /[A-Z]/.test(char);
            const keyCode = isUpperCase ? char.charCodeAt(0) : char.toUpperCase().charCodeAt(0);
            const textValue = char;

            if (isUpperCase) {
                // Press Shift down
                await Input.dispatchKeyEvent({
                    type: 'keyDown',
                    key: 'Shift',
                    code: 'ShiftLeft',
                    keyCode: 16,
                    charCode: 0,
                    repeat: false,
                    windowsVirtualKeyCode: 16,
                    nativeVirtualKeyCode: 16,
                    text: '',
                    unmodifiedText: '',
                    location: 1,
                });
            }

            // KeyDown event with 'text' property
            await Input.dispatchKeyEvent({
                type: 'keyDown',
                key: char,
                code: `Key${char.toUpperCase()}`,
                keyCode: keyCode,
                charCode: 0,
                repeat: false,
                windowsVirtualKeyCode: keyCode,
                nativeVirtualKeyCode: keyCode,
                text: textValue,
                unmodifiedText: textValue,
                location: 0,
            });

            // KeyUp event
            await Input.dispatchKeyEvent({
                type: 'keyUp',
                key: char,
                code: `Key${char.toUpperCase()}`,
                keyCode: keyCode,
                charCode: 0,
                repeat: false,
                windowsVirtualKeyCode: keyCode,
                nativeVirtualKeyCode: keyCode,
                text: '',
                unmodifiedText: '',
                location: 0,
            });

            if (isUpperCase) {
                // Release Shift
                await Input.dispatchKeyEvent({
                    type: 'keyUp',
                    key: 'Shift',
                    code: 'ShiftLeft',
                    keyCode: 16,
                    charCode: 0,
                    repeat: false,
                    windowsVirtualKeyCode: 16,
                    nativeVirtualKeyCode: 16,
                    text: '',
                    unmodifiedText: '',
                    location: 1,
                });
            }

            // Dynamic delay between 80ms to 120ms
            const delay = Math.floor(Math.random() * 40) + 80;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    } catch (error) {
        console.error(`Error entering text into node ${backendNodeId}:`, error);
        return;
    }
}
