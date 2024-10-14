export async function waitForDOMStable(client, stableTime = 500, maxWaitTime = 5000) {
    const { Runtime } = client;
  
    const pollInterval = 100; // Time between checks
    let lastChangeTime = Date.now();
    let startTime = Date.now();
  
    // Inject a MutationObserver into the page context
    await Runtime.evaluate({
      expression: `
          window.__dom_changes = false;
          if (window.__observer) {
              window.__observer.disconnect();
          }
          window.__observer = new MutationObserver(() => {
              window.__dom_changes = true;
          });
          window.__observer.observe(document, { attributes: true, childList: true, subtree: true });
      `,
      awaitPromise: false,
    });
  
    // Wait until document is ready and DOM is stable
    while (true) {
      // Check for timeout
      if (Date.now() - startTime > maxWaitTime) {
        break;
      }
  
      // Check document readiness
      const { result: readyStateResult } = await Runtime.evaluate({
        expression: `document.readyState`,
        returnByValue: true,
      });
  
      const readyState = readyStateResult.value;
  
      // Check if any DOM changes have occurred
      const { result: domChangesResult } = await Runtime.evaluate({
        expression: `window.__dom_changes`,
        returnByValue: true,
      });
  
      const domChanged = domChangesResult.value;
  
      if (readyState === 'complete' && !domChanged) {
        // Check if the DOM has been stable for the defined stableTime
        if (Date.now() - lastChangeTime >= stableTime) {
          break; // DOM is stable
        }
      } else {
        // Reset the lastChangeTime if DOM changed
        lastChangeTime = Date.now();
        // Reset the DOM changes flag
        await Runtime.evaluate({
          expression: `window.__dom_changes = false`,
          awaitPromise: false,
        });
      }
  
      // Wait before next check
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  
    // Clean up the MutationObserver
    await Runtime.evaluate({
      expression: `
        if (window.__observer) {
            window.__observer.disconnect();
            delete window.__observer;
        }
        delete window.__dom_changes;
      `,
      awaitPromise: false,
    });
  
    console.log('DOM stable');
  }