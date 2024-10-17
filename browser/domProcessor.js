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

  // **Add exception for option elements under select**
  if (node.tagName === 'option' && node.value != null) {
    return node; // Keep option nodes with values
  }

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

  line += node.tagName;
  if (node.interactable) {
    line += '(' + node.backendNodeId + ')';
  }

  // Collect significant attributes
  const attributes = [];

  if (node.interactable) {
    attributes.push(`interactable`);
  }
  if (node.disabled) {
    attributes.push(`disabled`);
  }
  if (node.value) {
    attributes.push(`value="${node.value}"`);
  }
  if (node.description) {
    attributes.push(`description="${node.description}"`);
  }
  if (node.title) {
    attributes.push(`title="${node.title}"`);
  }
  if (node.type) {
    attributes.push(`type="${node.type}"`);
  }
  if (node.ariaAttributes) {
    for (const [key, value] of Object.entries(node.ariaAttributes)) {
      attributes.push(`${key}="${value}"`);
    }
  }
  
  if (node.href) {
    if (node.target === '_blank') {
      attributes.push(`href="${node.href}"`, `note="not interactable, use GOTO url, page opens a new tab"`);
    } else {
      const truncatedHref = node.href.length > 25 ? node.href.substring(0, 25) + '...' : node.href;
      attributes.push(`href="${truncatedHref}"`);
    }
  }

  // Include attributes in the line
  if (attributes.length > 0) {
    line += ' [' + attributes.join(', ') + ']';
  }

  // Include text content if available
  if (node.textContent) {
    line += ` ${node.textContent}`;
  }

  line += '\n';

  // **Ensure options are displayed under select elements**
  if (node.tagName === 'select' && node.children && node.children.length > 0) {
    for (const child of node.children) {
      if (child.tagName === 'option') {
        const optionLine = '  '.repeat(indent + 1) + 'option';
        const optionAttributes = [];

        if (child.value) {
          optionAttributes.push(`value="${child.value}"`);
        }
        if (child.selected) {
          optionAttributes.push(`selected`);
        }

        // Include attributes for the option
        const optionLineWithAttributes =
          optionAttributes.length > 0
            ? optionLine + ' [' + optionAttributes.join(', ') + ']'
            : optionLine;

        // Include text content if available
        const optionTextContent = child.textContent ? ` ${child.textContent}` : '';
        line += optionLineWithAttributes + optionTextContent + '\n';
      }
    }
  }

  // Process child nodes
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      // Skip option children already processed
      if (node.tagName === 'select' && child.tagName === 'option') {
        continue;
      }
      if (child) {
        const childText = generateText(child, indent + 1);
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
  const reducedDom = reduceDom(dom[0]);
  // Generate the text representation
  const textOutput = generateText(reducedDom);

  return textOutput;
}
