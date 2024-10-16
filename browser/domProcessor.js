// Function to reduce the DOM according to specified rules
function reduceDom(node) {
  if (!node) return null;

  // Process children recursively
  let newChildren = [];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const reducedChild = reduceDom(child);
      if (reducedChild) {
        // If reducedChild is an array (flattened), merge it
        if (Array.isArray(reducedChild)) {
          newChildren = newChildren.concat(reducedChild);
        } else {
          newChildren.push(reducedChild);
        }
      }
    }
  }

  // Update the node's children
  node.children = newChildren.length > 0 ? newChildren : null;

  // Determine if the node is meaningful
  const hasMeaningfulContent =
    node.textContent ||
    node.interactable ||
    node.href ||
    node.value ||
    node.disabled ||
    node.description ||
    (node.ariaAttributes && Object.keys(node.ariaAttributes).length > 0);

  if (hasMeaningfulContent) {
    // Node is meaningful, keep it
    return node;
  } else if (node.children && node.children.length === 1) {
    // Node is not meaningful, has only one child, flatten it
    return node.children[0]; // Return the single child
  } else if (node.children && node.children.length > 1) {
    // Node is not meaningful, has multiple children, keep node to maintain hierarchy
    return node;
  } else {
    // Node and its children are not meaningful, remove it
    return null;
  }
}

// Function to generate the simplified text representation
export function generateText(node, indent = 0) {
  if (!node || !node.tagName) return ''; // Skip nodes without tagName

  let line = '  '.repeat(indent);

  line += node.tagName + '(' + node.backendNodeId + ')';

  // Collect significant attributes
  const attributes = [];
  if (node.href) {
    attributes.push(`href="${node.href}"`);
  }
  if (node.interactable) {
    attributes.push(`interactable: true`);
  }
  if (node.disabled) {
    attributes.push(`disabled: true`);
  }
  if (node.value) {
    attributes.push(`value="${node.value}"`);
  }
  if (node.ariaAttributes) {
    for (const [key, value] of Object.entries(node.ariaAttributes)) {
      attributes.push(`${key}="${value}"`);
    }
  }
  if (node.description) {
    attributes.push(`description: "${node.description}"`);
  }

  // Include attributes in the line
  if (attributes.length > 0) {
    line += ' [' + attributes.join(', ') + ']';
  }

  // Include text content if available
  if (node.textContent) {
    line += ` "${node.textContent}"`;
  }

  line += '\n';

  // Process child nodes
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      // Skip undefined or null child nodes
      if (child) {
        const childText = generateText(child, indent + 1);
        // Only add if childText is not empty
        if (childText.trim() !== '') {
          line += childText;
        }
      }
    }
  }

  return line;
}

// Function to process the DOM and generate text output
export function processDom(dom) {
  // Reduce the DOM before generating text
  const reducedDom = reduceDom(dom);

  // Generate the text representation
  const textOutput = generateText(reducedDom);

  return textOutput;
}
