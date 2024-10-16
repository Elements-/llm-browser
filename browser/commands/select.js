export async function execute(client, command) {
    const { DOM, Runtime } = client;
    const { backendNodeId, value } = command;
  
    try {
      // Focus on the select element
      await DOM.focus({ backendNodeId });
  
      // Resolve the node to get objectId
      const {
        object: { objectId },
      } = await DOM.resolveNode({ backendNodeId });
  
      // Set the value of the select element
      await Runtime.callFunctionOn({
        objectId,
        functionDeclaration: `
          function(newValue) {
            this.value = newValue;
            var event = new Event('change', { bubbles: true });
            this.dispatchEvent(event);
          }
        `,
        arguments: [{ value }],
      });
    } catch (error) {
      console.error(`Error selecting option in node ${backendNodeId}:`, error);
      return;
    }
  }