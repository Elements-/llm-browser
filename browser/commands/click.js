export async function execute(client, command) {
    const { DOM, Runtime } = client;
    const { backendNodeId } = command;
  
    try {
      const {
        object: { objectId },
      } = await DOM.resolveNode({ backendNodeId });
      await Runtime.callFunctionOn({
        objectId,
        functionDeclaration: 'function() { this.click(); }',
      });
    } catch (error) {
      console.error(`Error clicking node ${backendNodeId}:`, error);
      return;
    }
  }