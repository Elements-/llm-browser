// Function to flatten the DOM tree by removing unnecessary nesting
export function flattenDom(node) {
    if (!node || !node.tagName) return null; // Skip nodes without tagName
  
    // Process children first
    if (node.children && node.children.length > 0) {
      node.children = node.children
        .map((child) => flattenDom(child))
        .filter((child) => child !== null);
    }
  
    // Check if the node can be flattened
    if (node.children && node.children.length === 1) {
      const child = node.children[0];
  
      const insignificantTags = ['div', 'span'];
      const significantAttributes = ['id', 'class', 'textContent', 'href', 'ariaAttributes', 'description'];
  
      const hasSignificantAttributes = significantAttributes.some((attr) => node[attr]);
  
      const hasAttributes = node.attributes && Object.keys(node.attributes).length > 0;
      const hasAriaAttributes = node.ariaAttributes && Object.keys(node.ariaAttributes).length > 0;
  
      const parentIsInsignificant =
        insignificantTags.includes(node.tagName) &&
        !hasSignificantAttributes &&
        !hasAttributes &&
        !hasAriaAttributes;
  
      // Flatten even if interactable attribute is present
      const flattenable = parentIsInsignificant;
  
      if (flattenable) {
        // Merge interactable attribute if present
        if (node.interactable || child.interactable) {
          child.interactable = true;
        }
  
        // Merge disabled attribute if present
        if (node.disabled || child.disabled) {
          child.disabled = true;
        }
  
        // Merge textContent if present in parent but not in child
        if (node.textContent && !child.textContent) {
          child.textContent = node.textContent;
        }
  
        // Merge description if present in parent but not in child
        if (node.description && !child.description) {
          child.description = node.description;
        }
  
        return child;
      }
    }
  
    return node;
  }
  
  // Function to generate the simplified text representation
  export function generateText(node, indent = 0) {
    if (!node || !node.tagName) return ''; // Skip nodes without tagName
  
    let line = '';
    if (node.isNew) {
      line += '*NEW NODE* ';
    }

    line += '  '.repeat(indent);
  
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
    // Process each child in the root's children array
    const processedChildren = (dom.children || [])
      .map((child) => flattenDom(child))
      .filter((child) => child !== null);

    // Generate the text representation
    let textOutput = '';
    for (const child of processedChildren) {
      const childText = generateText(child);
      if (childText.trim() !== '') {
        textOutput += childText;
      }
    }
    return textOutput;
  }
