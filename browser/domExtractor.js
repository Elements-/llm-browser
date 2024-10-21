import { waitForDOMStable } from '../utils/waitForDom.js';

// Function to get the entire DOM tree and start processing
export async function extractDOM(client) {
  const { DOMSnapshot } = client;

  // Wait for the DOM to be stable
  await waitForDOMStable(client);

  // Enable DOMSnapshot
  await DOMSnapshot.enable();

  // Capture the snapshot
  const { documents, strings } = await DOMSnapshot.captureSnapshot({
    computedStyles: ['display', 'visibility', 'opacity', 'cursor', 'content'],
    includeDOMRects: true, // Necessary to get layout information
    includeTextValue: true,
    includeInputTextValue: true,
    includePseudoElements: true,
  });

  const domData = processSnapshot(documents, strings);

  return domData;
}

function processSnapshot(documents, strings) {
  const domData = [];

  for (const document of documents) {
    const { nodes, layout } = document;

    // Build a map from nodeIndex to layoutIndex
    const nodeToLayoutIndex = buildNodeToLayoutIndexMap(layout);

    // Build a map from node index to children node indices
    const childMap = buildChildMap(nodes);

    // Build the node data starting from the root nodes
    for (let i = 0; i < nodes.nodeType.length; i++) {
      if (nodes.parentIndex[i] === -1) {
        const nodeData = buildNodeData(
          i,
          document,
          childMap,
          strings,
          nodes,
          layout,
          nodeToLayoutIndex
        );
        if (nodeData) {
          domData.push(nodeData);
        }
      }
    }
  }

  return domData;
}

// Build a map from nodeIndex to layoutIndex
function buildNodeToLayoutIndexMap(layout) {
  const nodeToLayoutIndex = new Map();
  for (let layoutIndex = 0; layoutIndex < layout.nodeIndex.length; layoutIndex++) {
    const nodeIndex = layout.nodeIndex[layoutIndex];
    nodeToLayoutIndex.set(nodeIndex, layoutIndex);
  }
  return nodeToLayoutIndex;
}

function buildChildMap(nodes) {
  const childMap = new Map();

  for (let i = 0; i < nodes.nodeType.length; i++) {
    const parentIndex = nodes.parentIndex[i];
    if (parentIndex !== -1) {
      if (!childMap.has(parentIndex)) {
        childMap.set(parentIndex, []);
      }
      childMap.get(parentIndex).push(i);
    }
  }

  return childMap;
}

function buildNodeData(
  nodeIndex,
  document,
  childMap,
  strings,
  nodes,
  layout,
  nodeToLayoutIndex
) {
  const nodeType = nodes.nodeType[nodeIndex];
  const nodeNameIndex = nodes.nodeName[nodeIndex];
  const nodeName = strings[nodeNameIndex].toLowerCase();

  // Handle DOCUMENT_NODE
  if (nodeType === 9) {
    const nodeData = {
      tagName: '#document',
      backendNodeId: nodes.backendNodeId[nodeIndex],
    };

    // Recursively process child nodes
    const childIndices = childMap.get(nodeIndex);
    if (childIndices && childIndices.length > 0) {
      nodeData.children = [];

      for (const childIndex of childIndices) {
        const childData = buildNodeData(
          childIndex,
          document,
          childMap,
          strings,
          nodes,
          layout,
          nodeToLayoutIndex
        );
        if (childData) {
          nodeData.children.push(childData);
        }
      }

      // Clean up children array if empty
      if (nodeData.children.length === 0) {
        delete nodeData.children;
      }
    }

    return nodeData;
  }

  // Only process element nodes
  if (nodeType !== 1) {
    return null;
  }

  // Exclude certain tags
  if (['style', 'script', 'link', 'meta', 'hr', 'br', 'path'].includes(nodeName)) {
    return null;
  }

  const nodeData = {
    tagName: nodeName,
    backendNodeId: nodes.backendNodeId[nodeIndex],
  };

  // Get attributes
  const attributes = getNodeAttributes(nodeIndex, nodes, strings);

  // Include paths for links
  if (nodeName === 'a' && attributes.href) {
    nodeData.href = attributes.href;
  }

  // Include "title" & "type" & "target" for all
  if (attributes.title) {
    nodeData.title = attributes.title;
  }
  if (attributes.type) {
    nodeData.type = attributes.type;
  }
  if (attributes.target) {
    nodeData.target = attributes.target;
  }

  // Include value and selected state for option elements
  if (nodeName === 'option') {
    if (attributes.value != null) {
      nodeData.value = attributes.value;
    }
    if ('selected' in attributes) {
      nodeData.selected = true;
    }
    // Get text content for option elements
    const nodeValueIndex = nodes.nodeValue[nodeIndex];
    if (nodeValueIndex !== -1) {
      const nodeValue = strings[nodeValueIndex];
      if (nodeValue && nodeValue.trim()) {
        nodeData.textContent = nodeValue.trim();
      }
    }
  }

  // Include value for select elements
  if (nodeName === 'select') {
    if (attributes.value != null) {
      nodeData.value = attributes.value;
    }
  }

  // Include interactable state
  if (['select', 'option'].includes(nodeName)) {
    nodeData.interactable = true;
  }

  // Get aria attributes
  const ariaAttributes = {};
  for (const [attr, value] of Object.entries(attributes)) {
    if (attr.startsWith('aria-') && value != null) {
      ariaAttributes[attr] = value;
    }
  }
  if (Object.keys(ariaAttributes).length > 0) {
    nodeData.ariaAttributes = ariaAttributes;
  }

  // Include disabled state if the element is disabled
  if (attributes.disabled != null || attributes['aria-disabled'] === 'true') {
    nodeData.disabled = true;
  }

  // Include the current value for inputs and similar elements
  if (['input', 'textarea', 'select', 'option', 'label', 'button'].includes(nodeName)) {
    let currentValue = null;

    // Fetch the value from nodes.inputValue if available
    if (nodes.inputValue && nodes.inputValue.index) {
      const inputValueIndex = nodes.inputValue.index.indexOf(nodeIndex);
      if (inputValueIndex !== -1) {
        const valueStringIndex = nodes.inputValue.value[inputValueIndex];
        currentValue = strings[valueStringIndex];
      }
    }

    // For textarea elements, use nodes.textValue
    else if (nodeName === 'textarea' && nodes.textValue && nodes.textValue.index) {
      const textValueIndex = nodes.textValue.index.indexOf(nodeIndex);
      if (textValueIndex !== -1) {
        const valueStringIndex = nodes.textValue.value[textValueIndex];
        currentValue = strings[valueStringIndex];
      }
    }

    // Fallback to attributes if no value found
    else if (attributes.value != null) {
      currentValue = attributes.value;
    }

    if (currentValue != null) {
      nodeData.value = currentValue;
    }
  }

  // Get text content from child text nodes
  const textContent = getTextContent(nodeIndex, nodes, strings);
  if (textContent) {
    nodeData.textContent = textContent;
  }

  // Get computed styles
  const stylesForNode = getNodeStyles(
    nodeIndex,
    nodes,
    layout,
    strings,
    nodeToLayoutIndex
  );

  // Determine visibility from computed styles and layout
  const isVisible = computeVisibility(
    nodeIndex,
    document,
    stylesForNode,
    nodes,
    nodeToLayoutIndex
  );
  nodeData.isVisible = isVisible;

  // **Ensure select and option elements are marked as visible**
  if (['select', 'option'].includes(nodeName)) {
    nodeData.isVisible = true;
  }

  // Determine if the element is interactable

  if (nodeName === 'th' && attributes['data-priority'] === '3' && attributes['class'] === 'sorting' && attributes['tabindex'] === '0' && attributes['aria-controls'] === 'tableInvoicesList' && attributes['aria-label'] === 'Invoice Date: activate to sort column ascending') {
    console.log(nodeName, stylesForNode);
  }
  const isInteractable = computeInteractable(nodeName, stylesForNode);
  if (isInteractable) {
    nodeData.interactable = true;
  }

  // Recursively process child nodes
  const childIndices = childMap.get(nodeIndex);
  let hasVisibleChild = false;
  if (childIndices && childIndices.length > 0) {
    nodeData.children = [];

    for (const childIndex of childIndices) {
      const childData = buildNodeData(
        childIndex,
        document,
        childMap,
        strings,
        nodes,
        layout,
        nodeToLayoutIndex
      );
      if (childData) {
        nodeData.children.push(childData);
        if (childData.isVisible || (childData.children && childData.children.length > 0)) {
          hasVisibleChild = true;
        }
      }
    }

    // **If this is a select element and has no children, attempt to include option elements**
    if (nodeName === 'select' && (!nodeData.children || nodeData.children.length === 0)) {
      // **Attempt to include option elements even if they were previously filtered out**
      nodeData.children = [];
      for (const childIndex of childIndices) {
        const childNodeNameIndex = nodes.nodeName[childIndex];
        const childNodeName = strings[childNodeNameIndex].toLowerCase();
        if (childNodeName === 'option') {
          const optionData = buildNodeData(
            childIndex,
            document,
            childMap,
            strings,
            nodes,
            layout,
            nodeToLayoutIndex
          );
          if (optionData) {
            nodeData.children.push(optionData);
          }
        }
      }
    }

    // Clean up children array if empty
    if (nodeData.children.length === 0) {
      delete nodeData.children;
    }
  }

  // Include the node if it is visible or has visible children
  if (nodeData.isVisible || hasVisibleChild) {
    return nodeData;
  }

  // Exclude the node if it is not visible and has no visible children
  return null;
}

function getNodeAttributes(nodeIndex, nodes, strings) {
  const attributes = {};
  const attrIndices = nodes.attributes[nodeIndex];

  for (let i = 0; i < attrIndices.length; i += 2) {
    const name = strings[attrIndices[i]];
    const value = strings[attrIndices[i + 1]];
    attributes[name] = value;
  }

  return attributes;
}

function getTextContent(nodeIndex, nodes, strings) {
  let text = '';

  const childIndices = getChildNodeIndices(nodeIndex, nodes);

  if (childIndices) {
    for (const childIndex of childIndices) {
      const childNodeType = nodes.nodeType[childIndex];
      if (childNodeType === 3) {
        // TEXT_NODE
        const nodeValueIndex = nodes.nodeValue[childIndex];
        const nodeValue = strings[nodeValueIndex];
        if (nodeValue && nodeValue.trim()) {
          text += nodeValue.trim() + ' ';
        }
      }
    }
  }

  return text.trim() || null;
}

function getChildNodeIndices(nodeIndex, nodes) {
  const childIndices = [];

  for (let i = 0; i < nodes.nodeType.length; i++) {
    if (nodes.parentIndex[i] === nodeIndex) {
      childIndices.push(i);
    }
  }

  return childIndices.length > 0 ? childIndices : null;
}

function getNodeStyles(nodeIndex, nodes, layout, strings, nodeToLayoutIndex) {
  const stylesForNode = {};

  const layoutIndex = nodeToLayoutIndex.get(nodeIndex);
  if (layoutIndex === undefined || !layout.styles[layoutIndex]) {
    return stylesForNode;
  }

  const styleIndices = layout.styles[layoutIndex];
  const computedStyleProperties = ['display', 'visibility', 'opacity', 'cursor'];

  if (styleIndices && styleIndices.length > 0) {
    for (let i = 0; i < styleIndices.length; i++) {
      const propertyName = computedStyleProperties[i];
      const valueIndex = styleIndices[i];
      const value = strings[valueIndex];

      stylesForNode[propertyName] = value;
    }
  }

  return stylesForNode;
}

function computeVisibility(
  nodeIndex,
  document,
  stylesForNode,
  nodes,
  nodeToLayoutIndex
) {
  const { layout } = document;

  const layoutIndex = nodeToLayoutIndex.get(nodeIndex);
  if (layoutIndex === undefined || !layout.bounds[layoutIndex]) {
    return false;
  }

  const [x, y, width, height] = layout.bounds[layoutIndex];

  // Check if the node has size
  if (width <= 0 || height <= 0) {
    return false;
  }

  // Check computed styles
  const display = stylesForNode['display'];
  const visibility = stylesForNode['visibility'];
  const opacity = parseFloat(stylesForNode['opacity'] || '1');

  if (display === 'none' || visibility === 'hidden' || opacity === 0) {
    return false;
  }

  // The node is visible
  return true;
}

function computeInteractable(nodeName, stylesForNode) {
  const interactableTags = [
    'a',
    'button',
    'input',
    'select',
    'textarea',
    'option',
    'label',
  ];
  const hasPointerCursor = stylesForNode['cursor'] === 'pointer';
  const isInteractableTag = interactableTags.includes(nodeName);

  return isInteractableTag || hasPointerCursor;
}