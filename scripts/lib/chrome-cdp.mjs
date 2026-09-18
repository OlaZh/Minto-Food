// Shared installed-Chrome lifecycle and CDP transport for local QA scripts.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function startChrome(profile) {
  await fs.mkdir(profile, { recursive: true });
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  let launchError, ws, nextId = 0;
  chrome.on('error', error => { launchError = error; });
  const pending = new Map(), events = new Map();
  function close() {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer); waiter.reject(new Error('QA session closed'));
    }
    pending.clear(); ws?.close(); chrome.kill();
  }
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  try {
    let endpoint;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (launchError) throw launchError;
      if (chrome.exitCode !== null) throw new Error(`Chrome exited: ${chrome.exitCode}`);
      try {
        const [port, wsPath] = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
        endpoint = `ws://127.0.0.1:${port}${wsPath}`;
        break;
      } catch { await delay(250); }
    }
    if (!endpoint) throw new Error('Chrome did not expose DevTools within 15s; check sandbox restrictions.');
    ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket startup timeout')), 5000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket startup failed')); };
    });
    ws.onmessage = event => {
      const message = JSON.parse(event.data), waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id); clearTimeout(waiter.timer);
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
      } else events.get(message.sessionId)?.(message);
    };
    return { send, events, close };
  } catch (error) { close(); throw error; }
}
