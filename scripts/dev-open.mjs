import { spawn, exec } from 'node:child_process';

/**
 * Wraps `next dev` and opens the OS browser once the server prints its
 * actual URL — handles Next's automatic port fallback (3000 taken -> 3001,
 * etc.) instead of guessing a fixed port.
 */
const child = spawn('next dev', {
  shell: true,
  stdio: ['inherit', 'pipe', 'inherit'],
  env: { ...process.env, FORCE_COLOR: '1' }
});

let opened = false;

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (opened) return;

  const match = chunk.toString().match(/Local:\s+(http:\/\/\S+)/);
  if (!match) return;
  opened = true;

  const url = match[1];
  const openCommand =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(openCommand, () => {});
});

child.on('exit', (code) => process.exit(code ?? 0));
