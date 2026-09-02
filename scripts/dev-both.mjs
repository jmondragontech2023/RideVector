#!/usr/bin/env node
/**
 * Run local Worker + HTTP Vite + HTTPS Vite together.
 * One Vite process cannot serve both protocols; two instances share the Worker.
 *
 *   http://localhost:5173/          desktop / localhost geolocation
 *   https://<lan-or-tailscale>:5174 phone / Tailscale geolocation
 */
import { spawn } from 'node:child_process';

const children = [];

function start(label, args) {
  const child = spawn('pnpm', args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[dev:both] ${label} exited via ${signal}`);
    } else if (code && code !== 0) {
      console.error(`[dev:both] ${label} exited with code ${code}`);
    }
    shutdown(code ?? 1);
  });
  children.push(child);
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[dev:both] Worker :8787 | HTTP :5173 | HTTPS :5174 (LAN/Tailscale)');
start('api', ['--filter', '@ridevector/api', 'run', 'dev']);
start('web-http', ['--filter', '@ridevector/web', 'run', 'dev']);
start('web-https', ['--filter', '@ridevector/web', 'run', 'dev:mobile:side']);
