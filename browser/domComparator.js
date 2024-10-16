import gitDiff from 'git-diff';

export function computeGitDiff(originalString, newString) {
  const diffOutput = gitDiff(originalString, newString, { wordDiff: false });
  if (!diffOutput) {
    return { differencePercentage: 0, diffText: '', changedLines: 0 };
  }

  const diffLines = diffOutput.split('\n');
  let changesCount = 0;
  let changedLines = 0;

  const originalTotalLines = originalString.split('\n').length;
  const newTotalLines = newString.split('\n').length;
  let totalLines = Math.max(originalTotalLines, newTotalLines);

  diffLines.forEach(line => {
    if (line.startsWith('@@')) {
      console.log('line', line);
      const match = line.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
      if (match) {
        const originalLines = parseInt(match[2], 10);
        const newLines = parseInt(match[4], 10);
        changesCount += Math.abs(originalLines - newLines);
        totalLines += Math.max(originalLines, newLines);
        changedLines += Math.abs(originalLines - newLines);
      }
    }
  });

  const differencePercentage = (changesCount / totalLines) * 100;
  return { differencePercentage, diffText: diffOutput, changedLines };
}



