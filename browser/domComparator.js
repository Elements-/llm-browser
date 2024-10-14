import DiffMatchPatch from 'diff-match-patch';
import fs from 'fs';

// Function to compute the difference percentage between two text strings
export function computeDifferencePercentage(oldText, newText) {
  // Remove node IDs from oldText and newText using regex
  const nodeIdRegex = /\(\d+\)/g;
  const sanitizedOldText = oldText.replace(nodeIdRegex, '');
  const sanitizedNewText = newText.replace(nodeIdRegex, '');

  // Write sanitized old and new text to disk for debugging
  try {
    fs.writeFileSync('sanitized_old.txt', sanitizedOldText);
    fs.writeFileSync('sanitized_new.txt', sanitizedNewText);
    console.log('Debug files sanitized_old.txt and sanitized_new.txt have been written successfully.');
  } catch (error) {
    console.error('Error writing debug files:', error);
  }

  // Instantiate diff-match-patch
  const dmp = new DiffMatchPatch();

  // Compute the diff using diff-match-patch
  let diff = dmp.diff_main(sanitizedOldText, sanitizedNewText);
  // Optional cleanup to improve diff quality
  dmp.diff_cleanupSemantic(diff);

  let totalLength = 0;
  let changedLength = 0;

  for (const [op, data] of diff) {
    totalLength += data.length;
    if (op !== 0) {
      // op: -1 = deletion, 1 = insertion, 0 = equality
      changedLength += data.length;
    }
  }

  const differencePercentage = (changedLength / totalLength) * 100;

  console.log(`Difference Percentage: ${differencePercentage}%`);
  return differencePercentage;
}

// Function to find differences and annotate the new DOM representation
export function findTextDifferences(originalNode, newNode) {
  if (!originalNode && !newNode) {
    return;
  }

  if (!originalNode) {
    // Node is new
    newNode.isNew = true;
    if (newNode.children) {
      for (let i = 0; i < newNode.children.length; i++) {
        findTextDifferences(null, newNode.children[i]);
      }
    }
    return;
  }

  if (!newNode) {
    // Node was removed; handle if necessary
    return;
  }

  // Compare nodes
  if (nodesAreDifferent(originalNode, newNode)) {
    newNode.isNew = true;
  }

  // Recursively compare children
  const maxChildren = Math.max(
    (originalNode.children ? originalNode.children.length : 0),
    (newNode.children ? newNode.children.length : 0)
  );

  for (let i = 0; i < maxChildren; i++) {
    findTextDifferences(
      originalNode.children ? originalNode.children[i] : null,
      newNode.children ? newNode.children[i] : null
    );
  }
}

function nodesAreDifferent(nodeA, nodeB) {
  // Implement a thorough comparison of nodes
  // This could include comparing tagName, attributes, textContent, etc.
  if (nodeA.tagName !== nodeB.tagName) return true;
  if (nodeA.textContent !== nodeB.textContent) return true;
  // Compare attributes if necessary
  // ...

  return false;
}
