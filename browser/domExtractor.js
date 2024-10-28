import { waitForDOMStable } from '../utils/waitForDom.js';
import fs from 'fs';

// Function to get the entire DOM tree and start processing
export async function extractDOM(client) {
  const { Runtime, Accessibility, DOM } = client;

  // Wait for the DOM to be stable
  await waitForDOMStable(client);

  // Get the AX tree
  const { nodes } = await Accessibility.getFullAXTree();

  // DEBUG: A11Y TREE TESTING
  const nodesJson = JSON.stringify(nodes, null, 2);
  fs.writeFileSync('./debug/nodes.json', nodesJson);
 
  // Build a map from backendDOMNodeId to AX node for quick lookup
  const axNodeMap = new Map();
  for (const node of nodes) {
    if (node.backendDOMNodeId) {
      axNodeMap.set(node.backendDOMNodeId, node);
    }
  }

  // Get all DOM nodes with their attributes
  const { nodes: domNodes } = await DOM.getFlattenedDocument({ depth: -1, pierce: true });

  // Build a map from backendNodeId to DOM node attributes
  const domNodeAttributesMap = new Map();
  for (const domNode of domNodes) {
    if (domNode.backendNodeId && domNode.attributes) {
      const attributes = {};
      for (let i = 0; i < domNode.attributes.length; i += 2) {
        const name = domNode.attributes[i];
        const value = domNode.attributes[i + 1];
        attributes[name] = value;
      }
      domNodeAttributesMap.set(domNode.backendNodeId, attributes);
    }
  }

  // Augment AX nodes with ARIA attributes from DOM nodes
  for (const [backendNodeId, axNode] of axNodeMap.entries()) {
    const domAttributes = domNodeAttributesMap.get(backendNodeId);
    if (domAttributes) {
      // Extract ARIA attributes
      const ariaAttributes = {};
      for (const [key, value] of Object.entries(domAttributes)) {
        if (key.startsWith('aria-')) {
          ariaAttributes[key] = value;
        }
      }
      if (Object.keys(ariaAttributes).length > 0) {
        axNode.ariaAttributes = ariaAttributes;
        for(let k in ariaAttributes) {
          let suffix = k.replace('aria-', '');
          if(!axNode.properties) continue
          if(axNode.properties.find(p => p.name === suffix)) {
            continue;
          }
          axNode.properties.push({
            name: suffix,
            value: { type: 'string', value: ariaAttributes[k] }
          });
        }
      }
    }
  }

  // Build a map from nodeId to node for quick lookup
  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
  }

  // Link each node with its children
  for (const node of nodes) {
    if (node.childIds) {
      node.children = node.childIds
        .map(childId => nodeMap.get(childId))
        .filter(Boolean);
    } else {
      node.children = [];
    }
  }

  // Find root nodes (nodes without a parentId)
  const rootNodes = nodes.filter(node => !node.parentId);

  const axTreeString = rootNodes
    .map(node => buildAXTreeString(node))
    .join('');
  fs.writeFileSync('./debug/a11y.txt', axTreeString);

  // Get the current URL
  const { result } = await Runtime.evaluate({
    expression: 'window.location.href',
    returnByValue: true,
  });
  const currentURL = result.value;

  return { domTree: axTreeString, currentURL };
}

function buildAXTreeString(node, depth = 0) {
  const role = (node.role && node.role.value) || '';
  const name = (node.name && node.name.value) || '';
  const backendNodeId = node.backendDOMNodeId || '';
  let properties = '';
  let focusable = false;

  if(role === 'image') {
    return '';
  }

  let isEmpty = (!node.properties || node.properties.length === 0) &&
    !name;

  if (node.ignored || !backendNodeId || isEmpty) {
    // Skip this node but include its children at the same depth
    let treeString = '';
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        treeString += buildAXTreeString(child, depth);
      }
    }
    return treeString;
  }

  if (node.properties) {
    properties = node.properties
      .map(prop => {
        if (prop.name === 'focusable' && prop.value.value === true) {
          focusable = true;
        }
        const key = prop.name;
        const value = prop.value.value;
        if (typeof value === 'boolean') {
          return value ? key : '';
        } else {
          return `${key}=${value}`;
        }
      })
      .filter(s => s)
      .join(', ');

    if (properties) {
      properties = `(${properties})`;
    }
  }

  let treeString = `${'  '.repeat(depth)}${role}${focusable ? `[${backendNodeId}]`: ''}${properties} ${name}\n`;

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      treeString += buildAXTreeString(child, depth + 1);
    }
  }
  return treeString;
}
