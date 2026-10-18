/** Small inspector client for local automated verification; never opens a UI. */
export async function inspectorEndpoint(port, accept = () => true, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) });
      const match = (await response.json()).find(accept);
      if (match) return match;
    } catch { /* Process may be restarting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Inspector local ${port} indisponível após ${timeout} ms.`);
}

export async function connectInspector(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const requests = new Map(), listeners = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const pending = requests.get(message.id);
      if (pending) { requests.delete(message.id); clearTimeout(pending.timer); message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result); }
    } else for (const callback of listeners.get(message.method) ?? []) callback(message.params);
  });
  return {
    command(method, params = {}) {
      const requestId = ++id;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { requests.delete(requestId); reject(new Error(`Inspector não respondeu: ${method}`)); }, 15000);
        requests.set(requestId, { resolve, reject, timer }); socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    event(method) {
      return new Promise((resolve, reject) => {
        const callbacks = listeners.get(method) ?? new Set(); listeners.set(method, callbacks);
        const timer = setTimeout(() => { callbacks.delete(done); reject(new Error(`Evento ausente: ${method}`)); }, 15000);
        const done = value => { clearTimeout(timer); callbacks.delete(done); resolve(value); }; callbacks.add(done);
      });
    },
    close() { socket.close(); }
  };
}
