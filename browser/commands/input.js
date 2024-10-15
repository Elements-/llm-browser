export async function execute(client, command) {
    const { DOM, Input, Runtime } = client;
    const { backendNodeId, text } = command;
  
    console.log('input command', command);

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
        await Input.dispatchKeyEvent({ type: 'char', text: char });
      }
    } catch (error) {
      console.error(`Error entering text into node ${backendNodeId}:`, error);
      return;
    }
  }