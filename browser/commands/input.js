export async function execute(client, command) {
    const { DOM, Input, Runtime } = client;
    const { backendNodeId, text } = command;

    // Key mapping for characters
    const keyMap = {
        'a': { code: 'KeyA', keyCode: 65 },
        'b': { code: 'KeyB', keyCode: 66 },
        'c': { code: 'KeyC', keyCode: 67 },
        'd': { code: 'KeyD', keyCode: 68 },
        'e': { code: 'KeyE', keyCode: 69 },
        'f': { code: 'KeyF', keyCode: 70 },
        'g': { code: 'KeyG', keyCode: 71 },
        'h': { code: 'KeyH', keyCode: 72 },
        'i': { code: 'KeyI', keyCode: 73 },
        'j': { code: 'KeyJ', keyCode: 74 },
        'k': { code: 'KeyK', keyCode: 75 },
        'l': { code: 'KeyL', keyCode: 76 },
        'm': { code: 'KeyM', keyCode: 77 },
        'n': { code: 'KeyN', keyCode: 78 },
        'o': { code: 'KeyO', keyCode: 79 },
        'p': { code: 'KeyP', keyCode: 80 },
        'q': { code: 'KeyQ', keyCode: 81 },
        'r': { code: 'KeyR', keyCode: 82 },
        's': { code: 'KeyS', keyCode: 83 },
        't': { code: 'KeyT', keyCode: 84 },
        'u': { code: 'KeyU', keyCode: 85 },
        'v': { code: 'KeyV', keyCode: 86 },
        'w': { code: 'KeyW', keyCode: 87 },
        'x': { code: 'KeyX', keyCode: 88 },
        'y': { code: 'KeyY', keyCode: 89 },
        'z': { code: 'KeyZ', keyCode: 90 },
        'A': { code: 'KeyA', keyCode: 65, shift: true },
        'B': { code: 'KeyB', keyCode: 66, shift: true },
        'C': { code: 'KeyC', keyCode: 67, shift: true },
        'D': { code: 'KeyD', keyCode: 68, shift: true },
        'E': { code: 'KeyE', keyCode: 69, shift: true },
        'F': { code: 'KeyF', keyCode: 70, shift: true },
        'G': { code: 'KeyG', keyCode: 71, shift: true },
        'H': { code: 'KeyH', keyCode: 72, shift: true },
        'I': { code: 'KeyI', keyCode: 73, shift: true },
        'J': { code: 'KeyJ', keyCode: 74, shift: true },
        'K': { code: 'KeyK', keyCode: 75, shift: true },
        'L': { code: 'KeyL', keyCode: 76, shift: true },
        'M': { code: 'KeyM', keyCode: 77, shift: true },
        'N': { code: 'KeyN', keyCode: 78, shift: true },
        'O': { code: 'KeyO', keyCode: 79, shift: true },
        'P': { code: 'KeyP', keyCode: 80, shift: true },
        'Q': { code: 'KeyQ', keyCode: 81, shift: true },
        'R': { code: 'KeyR', keyCode: 82, shift: true },
        'S': { code: 'KeyS', keyCode: 83, shift: true },
        'T': { code: 'KeyT', keyCode: 84, shift: true },
        'U': { code: 'KeyU', keyCode: 85, shift: true },
        'V': { code: 'KeyV', keyCode: 86, shift: true },
        'W': { code: 'KeyW', keyCode: 87, shift: true },
        'X': { code: 'KeyX', keyCode: 88, shift: true },
        'Y': { code: 'KeyY', keyCode: 89, shift: true },
        'Z': { code: 'KeyZ', keyCode: 90, shift: true },
        '0': { code: 'Digit0', keyCode: 48 },
        '1': { code: 'Digit1', keyCode: 49 },
        '2': { code: 'Digit2', keyCode: 50 },
        '3': { code: 'Digit3', keyCode: 51 },
        '4': { code: 'Digit4', keyCode: 52 },
        '5': { code: 'Digit5', keyCode: 53 },
        '6': { code: 'Digit6', keyCode: 54 },
        '7': { code: 'Digit7', keyCode: 55 },
        '8': { code: 'Digit8', keyCode: 56 },
        '9': { code: 'Digit9', keyCode: 57 },
        '!': { code: 'Digit1', keyCode: 49, shift: true },
        '@': { code: 'Digit2', keyCode: 50, shift: true },
        '#': { code: 'Digit3', keyCode: 51, shift: true },
        '$': { code: 'Digit4', keyCode: 52, shift: true },
        '%': { code: 'Digit5', keyCode: 53, shift: true },
        '^': { code: 'Digit6', keyCode: 54, shift: true },
        '&': { code: 'Digit7', keyCode: 55, shift: true },
        '*': { code: 'Digit8', keyCode: 56, shift: true },
        '(': { code: 'Digit9', keyCode: 57, shift: true },
        ')': { code: 'Digit0', keyCode: 48, shift: true },
        '-': { code: 'Minus', keyCode: 189 },
        '_': { code: 'Minus', keyCode: 189, shift: true },
        '=': { code: 'Equal', keyCode: 187 },
        '+': { code: 'Equal', keyCode: 187, shift: true },
        '[': { code: 'BracketLeft', keyCode: 219 },
        '{': { code: 'BracketLeft', keyCode: 219, shift: true },
        ']': { code: 'BracketRight', keyCode: 221 },
        '}': { code: 'BracketRight', keyCode: 221, shift: true },
        ';': { code: 'Semicolon', keyCode: 186 },
        ':': { code: 'Semicolon', keyCode: 186, shift: true },
        "'": { code: 'Quote', keyCode: 222 },
        '"': { code: 'Quote', keyCode: 222, shift: true },
        ',': { code: 'Comma', keyCode: 188 },
        '<': { code: 'Comma', keyCode: 188, shift: true },
        '.': { code: 'Period', keyCode: 190 },
        '>': { code: 'Period', keyCode: 190, shift: true },
        '/': { code: 'Slash', keyCode: 191 },
        '?': { code: 'Slash', keyCode: 191, shift: true },
        '`': { code: 'Backquote', keyCode: 192 },
        '~': { code: 'Backquote', keyCode: 192, shift: true },
        '\\': { code: 'Backslash', keyCode: 220 },
        '|': { code: 'Backslash', keyCode: 220, shift: true },
        ' ': { code: 'Space', keyCode: 32 },
    };

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
            const keyInfo = keyMap[char];

            if (!keyInfo) {
                console.error(`No key mapping for character: ${char}`);
                continue;
            }

            const { code, keyCode, shift } = keyInfo;
            const textValue = char;

            if (shift) {
                // Press Shift down
                await Input.dispatchKeyEvent({
                    type: 'keyDown',
                    key: 'Shift',
                    code: 'ShiftLeft',
                    keyCode: 16,
                    windowsVirtualKeyCode: 16,
                    nativeVirtualKeyCode: 16,
                    location: 1,
                });
            }

            // KeyDown event
            await Input.dispatchKeyEvent({
                type: 'keyDown',
                key: char,
                code: code,
                keyCode: keyCode,
                windowsVirtualKeyCode: keyCode,
                nativeVirtualKeyCode: keyCode,
                text: '',
                unmodifiedText: '',
            });

            // KeyPress event (character typing)
            await Input.dispatchKeyEvent({
                type: 'char',
                key: char,
                code: code,
                keyCode: 0,
                windowsVirtualKeyCode: 0,
                nativeVirtualKeyCode: 0,
                text: textValue,
                unmodifiedText: textValue,
            });

            // KeyUp event
            await Input.dispatchKeyEvent({
                type: 'keyUp',
                key: char,
                code: code,
                keyCode: keyCode,
                windowsVirtualKeyCode: keyCode,
                nativeVirtualKeyCode: keyCode,
                text: '',
                unmodifiedText: '',
            });

            if (shift) {
                // Release Shift
                await Input.dispatchKeyEvent({
                    type: 'keyUp',
                    key: 'Shift',
                    code: 'ShiftLeft',
                    keyCode: 16,
                    windowsVirtualKeyCode: 16,
                    nativeVirtualKeyCode: 16,
                    location: 1,
                });
            }

            // Dynamic delay between 80ms to 120ms
            const delay = Math.floor(Math.random() * 40) + 80;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    } catch (error) {
        console.error(`Error entering text into node ${backendNodeId}:`, error);
        return;
    }
}
