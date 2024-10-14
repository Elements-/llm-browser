export async function execute(client, command) {
    const { DOM, Runtime } = client;
    const { nodeId } = command;
  
    try {
      const {
        object: { objectId },
      } = await DOM.resolveNode({ nodeId });
      await Runtime.callFunctionOn({
        objectId,
        functionDeclaration: 'function() { this.click(); }',
      });
    } catch (error) {
      console.error(`Error clicking node ${nodeId}:`, error);
      return;
    }
  }