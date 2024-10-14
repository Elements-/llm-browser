import { waitForDOMStable } from '../utils/waitForDom.js';
import { processSVG } from './svgProcessor.js';

// Shared processNode function
export async function processNode(nodeId, client) {
  const { DOM, Runtime } = client;
  let nodeData = null;

  try {
    const { node } = await DOM.describeNode({ nodeId, depth: 1 });

    // Resolve the node to get objectId
    const {
      object: { objectId },
    } = await DOM.resolveNode({ nodeId });

    // Get the tagName
    const { result: tagNameResult } = await Runtime.callFunctionOn({
      objectId: objectId,
      functionDeclaration: `function() { return this.tagName ? this.tagName.toLowerCase() : ''; }`,
      returnByValue: true,
      awaitPromise: true,
    });

    const tagName = tagNameResult.value || '';

    // Build node data
    nodeData = {
      tagName: tagName,
      nodeId: nodeId,
    };

    if (node.nodeType === 1) {
      // Element node
      // Execute function in page context to check if the element is in viewport
      const { result: visibilityResult } = await Runtime.callFunctionOn({
        objectId: objectId,
        functionDeclaration: `
            function() {
                const rect = this.getBoundingClientRect();
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                const isInViewport = 
                    rect.width > 0 &&
                    rect.height > 0 &&
                    ((rect.top >= 0 && rect.top < viewportHeight) ||
                     (rect.bottom > 0 && rect.bottom <= viewportHeight) ||
                     (rect.top < 0 && rect.bottom > viewportHeight)) &&
                    ((rect.left >= 0 && rect.left < viewportWidth) ||
                     (rect.right > 0 && rect.right <= viewportWidth) ||
                     (rect.left < 0 && rect.right > viewportWidth));
                return isInViewport;
            }
        `,
        returnByValue: true,
        awaitPromise: true,
      });

      let isVisible = visibilityResult.value;

      if (tagName === 'option') {
        isVisible = true;
      }

      // Only proceed if the element is in the viewport
      if (!isVisible) {
        await Runtime.releaseObject({ objectId });
        return null;
      }

      // Get attributes
      const { result: attributesResult } = await Runtime.callFunctionOn({
        objectId: objectId,
        functionDeclaration: `
            function() {
                const attrs = {};
                for (let attr of this.getAttributeNames()) {
                    attrs[attr] = this.getAttribute(attr);
                }
                return attrs;
            }
        `,
        returnByValue: true,
        awaitPromise: true,
      });

      const attributes = attributesResult.value;

      // Include paths for links
      if (tagName === 'a' && attributes.href) {
        nodeData.href = attributes.href;
      }

      // Handle SVG elements
      if (tagName === 'svg') {
        // Get the SVG outerHTML
        const { result: outerHTMLResult } = await Runtime.callFunctionOn({
          objectId: objectId,
          functionDeclaration: `function() { return this.outerHTML; }`,
          returnByValue: true,
          awaitPromise: true,
        });

        const svgMarkup = outerHTMLResult.value;

        // Process the SVG to get a description in parallel
        const descriptionPromise = processSVG(svgMarkup);

        // Proceed to process child nodes if any
        if (node.childNodeCount && node.childNodeCount > 0) {
          nodeData.children = [];
          // Request child nodes
          await DOM.requestChildNodes({ nodeId, depth: 1 });
          const { node: updatedNode } = await DOM.describeNode({ nodeId, depth: 1 });
          node.children = updatedNode.children;

          for (const child of node.children || []) {
            const childData = await processNode(child.nodeId, client);
            if (childData) {
              nodeData.children.push(childData);
            }
          }

          // Clean up children array if empty
          if (nodeData.children.length === 0) {
            delete nodeData.children;
          }
        }

        // Wait for the SVG description to be processed
        const description = await descriptionPromise;
        console.log(description);

        if (description) {
          nodeData.description = description;
        }

        // Release the object
        await Runtime.releaseObject({ objectId });

        return nodeData;
      }

      // Get text content excluding child elements
      const { result: textContentResult } = await Runtime.callFunctionOn({
        objectId: objectId,
        functionDeclaration: `
            function() { 
                let text = '';
                for (let node of this.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        text += node.textContent;
                    }
                }
                return text.trim();
            }
        `,
        returnByValue: true,
        awaitPromise: true,
      });

      const textContent = textContentResult.value || '';

      if (textContent) {
        nodeData.textContent = textContent;
      }

      // Determine if the element is interactable
      const interactableTags = ['a', 'button', 'input', 'select', 'textarea', 'option', 'label'];
      const { result: cursorStyleResult } = await Runtime.callFunctionOn({
        objectId: objectId,
        functionDeclaration: `
            function() {
                return window.getComputedStyle(this).cursor;
            }
        `,
        returnByValue: true,
        awaitPromise: true,
      });
      const cursorStyle = cursorStyleResult.value;
      const isInteractable = interactableTags.includes(tagName) || cursorStyle === 'pointer';

      if (isInteractable) {
        nodeData.interactable = true;

        // Add disabled flag if the element is disabled
        const { result: disabledResult } = await Runtime.callFunctionOn({
          objectId: objectId,
          functionDeclaration: `
              function() {
                  return this.disabled || this.getAttribute('aria-disabled') === 'true';
              }
          `,
          returnByValue: true,
          awaitPromise: true,
        });
        const isDisabled = disabledResult.value;
        if (isDisabled) {
          nodeData.disabled = true;
        }

        // Include the current value for inputs and similar elements
        if (['input', 'textarea', 'select'].includes(tagName)) {
          const { result: valueResult } = await Runtime.callFunctionOn({
            objectId: objectId,
            functionDeclaration: `function() { return this.value; }`,
            returnByValue: true,
            awaitPromise: true,
          });
          const value = valueResult.value;
          if (value) {
            nodeData.value = value;
          }
        }
      }

      // Get aria attributes
      const ariaAttributes = {};
      for (const [attr, value] of Object.entries(attributes)) {
        if (attr.startsWith('aria-') && value !== null && value !== undefined) {
          ariaAttributes[attr] = value;
        }
      }

      if (Object.keys(ariaAttributes).length > 0) {
        nodeData.ariaAttributes = ariaAttributes;
      }

      // Release the object
      await Runtime.releaseObject({ objectId });
    }

    // Recursively process child nodes
    if (node.childNodeCount && node.childNodeCount > 0) {
      nodeData.children = [];
      // Request child nodes
      await DOM.requestChildNodes({ nodeId, depth: 1 });
      const { node: updatedNode } = await DOM.describeNode({ nodeId, depth: 1 });
      node.children = updatedNode.children;

      for (const child of node.children || []) {
        const childData = await processNode(child.nodeId, client);
        if (childData) {
          nodeData.children.push(childData);
        }
      }

      // Clean up children array if empty
      if (nodeData.children.length === 0) {
        delete nodeData.children;
      }
    }
  } catch (error) {
    // If an error occurs, skip this node
    return null;
  }

  return nodeData;
}

// Function to get the updated DOM representation
export async function getDOMRepresentation(client) {
  const { DOM } = client;

  // Wait for the DOM to be ready
  await waitForDOMStable(client);

  const { root } = await DOM.getDocument();

  // Use the processNode function
  const domRepresentation = await processNode(root.nodeId, client);
  return domRepresentation;
}