export async function waitForDOMStable(client, stableTime = 500, networkIdleTime = 500, maxWaitTime = 5000) {
  const { Runtime, Network } = client;
  let lastChangeTime = Date.now();
  let lastRequestTime = Date.now();
  let inflightRequests = 0;
  const startTime = Date.now();

  // Enable Network domain
  await Network.enable();

  // Setup network listeners
  Network.requestWillBeSent(() => {
    inflightRequests++;
    lastRequestTime = Date.now();
  });

  Network.loadingFinished(() => {
    inflightRequests--;
    lastRequestTime = Date.now();
  });

  Network.loadingFailed(() => {
    inflightRequests--;
    lastRequestTime = Date.now();
  });

  // Inject MutationObserver
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

  while (true) {
    if (Date.now() - startTime > maxWaitTime) {
      console.warn('Timed out waiting for DOM to be stable and network to be idle');
      break;
    }

    // Check for DOM changes
    const { result: domChangesResult } = await Runtime.evaluate({
      expression: `window.__dom_changes`,
      returnByValue: true,
    });

    const domChanged = domChangesResult.value;

    if (domChanged) {
      lastChangeTime = Date.now();
      await Runtime.evaluate({
        expression: `window.__dom_changes = false`,
        awaitPromise: false,
      });
    }

    const domStable = (Date.now() - lastChangeTime) >= stableTime;
    const networkIdle = inflightRequests === 0 && (Date.now() - lastRequestTime) >= networkIdleTime;

    if (domStable && networkIdle) {
      console.log('DOM is stable and network is idle');
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Clean up
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

  await Network.disable();
}
