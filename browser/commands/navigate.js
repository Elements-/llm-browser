export async function execute(client, command) {
    const { Page } = client;
    const { url } = command;
  
    try {
      await Page.navigate({ url });
      await Page.loadEventFired();
    } catch (error) {
      console.error(`Error navigating to URL ${url}:`, error);
      return;
    }
  }