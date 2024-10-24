import { waitForDOMStable } from '../utils/waitForDom.js';
import fs from 'fs';

// Function to get the entire DOM tree and start processing
export async function extractDOM(client) {
  const { DOMSnapshot, Runtime, Accessibility } = client;

  // Wait for the DOM to be stable
  await waitForDOMStable(client);

  const { nodes } = await Accessibility.getFullAXTree();

  // DEBUG: A11Y TREE TESTING
  const nodesJson = JSON.stringify(nodes, null, 2);
  fs.writeFileSync('./debug/nodes.json', nodesJson);
  console.log('Accessibility tree nodes have been written to nodes.json');

  // Build a map from nodeId to node for quick lookup
  const nodeMap = new Map();
  for (const node of nodes) {
    nodeMap.set(node.nodeId, node);
  }

  // Link each node with its children
  for (const node of nodes) {
    if (node.childIds) {
      node.children = node.childIds.map(childId => nodeMap.get(childId)).filter(Boolean);
    } else {
      node.children = [];
    }
  }

  // Find root nodes (nodes without a parentId)
  const rootNodes = nodes.filter(node => !node.parentId);

  const axTreeString = rootNodes.map(node => buildAXTreeString(node)).join('');
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

  if (node.ignored || !backendNodeId) {
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