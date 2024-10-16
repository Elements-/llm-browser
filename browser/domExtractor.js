import { waitForDOMStable } from '../utils/waitForDom.js';
import { processSVG } from './svgProcessor.js';

/*
- function breakout
- reduce callFunctionOn, seek native properties where possible
*/

// Shared processNode function
export async function processNode(backendNodeId, client) {
  const { DOM, Runtime } = client;
  let nodeData = null;

  try {
    const { node } = await DOM.describeNode({ backendNodeId, depth: 1 });

    // Resolve the node to get objectId
    const {
      object: { objectId },
    } = await DOM.resolveNode({ backendNodeId });

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
      backendNodeId: backendNodeId,
    };

    if (node.nodeType === 1) {
      // Element node
      // Execute function in page context to check if the element is visible or can be scrolled to
      const { result: visibilityResult } = await Runtime.callFunctionOn({
        objectId: objectId,
        functionDeclaration: `
            function() {
                const rect = this.getBoundingClientRect();
                const documentHeight = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight,
                    document.body.offsetHeight,
                    document.documentElement.offsetHeight,
                    document.body.clientHeight,
                    document.documentElement.clientHeight
                );
                const documentWidth = Math.max(
                    document.body.scrollWidth,
                    document.documentElement.scrollWidth,
                    document.body.offsetWidth,
                    document.documentElement.offsetWidth,
                    document.body.clientWidth,
                    document.documentElement.clientWidth
                );

                return rect.width > 0 &&
                       rect.height > 0 &&
                       rect.bottom > 0 &&
                       rect.right > 0 &&
                       rect.top < documentHeight &&
                       rect.left < documentWidth;
            }
        `,
        returnByValue: true,
        awaitPromise: true,
      });

      let isVisible = visibilityResult.value;

      if (tagName === 'option') {
        isVisible = true;
      }


      nodeData.isVisible = isVisible;

      // Only proceed if the element is in the viewport
      if (!isVisible) {
        // Release the object but do not return early
        await Runtime.releaseObject({ objectId });
      } else {
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
            await DOM.requestChildNodes({ nodeId: node.nodeId, depth: 1 });
            const { node: updatedNode } = await DOM.describeNode({ backendNodeId, depth: 1 });
            node.children = updatedNode.children;

            for (const child of node.children || []) {

              const childData = await processNode(child.backendNodeId, client);
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

          if (description) {
            nodeData.description = description;
          }

          // Release the object
          await Runtime.releaseObject({ objectId });
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
    }

    // Recursively process child nodes
    if (node.childNodeCount && node.childNodeCount > 0) {
      nodeData.children = [];
      // Request child nodes
      await DOM.requestChildNodes({ nodeId: node.nodeId, depth: 1 });
      const { node: updatedNode } = await DOM.describeNode({ backendNodeId, depth: 1 });
      node.children = updatedNode.children;

      for (const child of node.children || []) {
        const childData = await processNode(child.backendNodeId, client);
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
    //console.error(`Error processing node ${backendNodeId}:`, error);
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
  const domRepresentation = await processNode(root.backendNodeId, client);
  return domRepresentation;
}
