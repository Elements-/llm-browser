import readline from 'readline';

export function setupCLI(onInput, onClose) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '',
  });

  rl.prompt();

  rl.on('line', async (input) => {
    await onInput(input);
    rl.prompt();
  });

  rl.on('close', async () => {
    await onClose();
  });

  onInput('go to https://www.newegg.com/p/pl?d=ddr3+ram')
}