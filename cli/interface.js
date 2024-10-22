import readline from 'readline';

export function setupCLI(onInput, onClose) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'ENTER PROMPT:',
  });

  rl.prompt();

  rl.on('line', async (input) => {
    await onInput(input);
    rl.prompt();
  });

  rl.on('close', async () => {
    await onClose();
  });
}