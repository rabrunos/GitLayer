import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { randomUUID, createHash } from 'node:crypto';

// A fixture WebDAV endpoint, not a Git implementation. Git's real http-push
// constructs compressed objects and updates refs; this server only implements
// bounded HTTP file operations under one newly-created bare fixture directory.
export async function createWebDav(directory) {
  const root = fs.realpathSync(directory), mount = `/dav-${randomUUID()}/remote.git/`;
  const requests = [], locks = new Map(), failures = [];
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const xml = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  let origin;
  function target(input) {
    const url = new URL(input, origin);
    if (url.origin !== origin || !url.pathname.startsWith(mount)) throw Object.assign(Error('Route outside fixture mount'), { status: 403 });
    const relative = decodeURIComponent(url.pathname.slice(mount.length));
    if (relative.includes('\\') || /[:\0]/.test(relative) || relative.split('/').some(part => part === '.' || part === '..')) throw Object.assign(Error('Invalid fixture path'), { status: 403 });
    const full = path.resolve(root, relative), rel = path.relative(root, full);
    if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw Object.assign(Error('Path leaves fixture'), { status: 403 });
    let cursor = root;
    for (const part of rel.split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      try { if (fs.lstatSync(cursor).isSymbolicLink()) throw Object.assign(Error('Fixture links refused'), { status: 403 }); }
      catch (error) { if (error.code === 'ENOENT') break; throw error; }
    }
    return { full, relative: rel.split(path.sep).join('/') };
  }
  const href = (relative, isDirectory) => mount + relative.split('/').filter(Boolean).map(encodeURIComponent).join('/') + (isDirectory && relative ? '/' : '');
  const properties = (relative, stat) => `<D:response><D:href>${xml(href(relative, stat.isDirectory()))}</D:href><D:propstat><D:prop><D:resourcetype>${stat.isDirectory() ? '<D:collection/>' : ''}</D:resourcetype><D:getcontentlength>${stat.size}</D:getcontentlength><D:supportedlock><D:lockentry><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype></D:lockentry></D:supportedlock></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
  const lockDocument = token => `<?xml version="1.0"?><D:prop xmlns:D="DAV:"><D:lockdiscovery><D:activelock><D:locktype><D:write/></D:locktype><D:lockscope><D:exclusive/></D:lockscope><D:depth>0</D:depth><D:owner><D:href>mailto:validation@example.invalid</D:href></D:owner><D:timeout>Second-600</D:timeout><D:locktoken><D:href>${xml(token)}</D:href></D:locktoken></D:activelock></D:lockdiscovery></D:prop>`;
  function permittedWrite(relative, req) {
    const lock = locks.get(relative);
    if (lock && !String(req.headers.if ?? '').includes(lock.token)) throw Object.assign(Error('Exclusive resource lock token required'), { status: 423 });
  }
  const server = http.createServer(async (req, res) => {
    const entry = { method: req.method, path: null, status: null, inputBytes: 0, inputSha256: null, depth: req.headers.depth ?? null, lockTokenSupplied: Boolean(req.headers.if || req.headers['lock-token']) };
    requests.push(entry);
    const send = (status, body = '', headers = {}) => { const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body); entry.status = status; res.writeHead(status, { 'Content-Length': bytes.length, ...headers }); res.end(req.method === 'HEAD' ? undefined : bytes); };
    try {
      const item = target(req.url); entry.path = item.relative || '/';
      const chunks = [];
      for await (const chunk of req) { entry.inputBytes += chunk.length; if (entry.inputBytes > 8 * 1024 * 1024) throw Object.assign(Error('Fixture request exceeds 8 MiB'), { status: 413 }); chunks.push(chunk); }
      const body = Buffer.concat(chunks); entry.inputSha256 = digest(body);
      if (req.method === 'OPTIONS') { send(200, '', { DAV: '1,2', Allow: 'OPTIONS, GET, HEAD, PROPFIND, MKCOL, LOCK, PUT, MOVE, UNLOCK, DELETE' }); return; }
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (!fs.existsSync(item.full) || !fs.statSync(item.full).isFile()) { send(404, 'Not found'); return; }
        send(200, fs.readFileSync(item.full), { 'Content-Type': item.relative.endsWith('info/refs') || item.relative === 'HEAD' ? 'text/plain; charset=utf-8' : 'application/octet-stream' }); return;
      }
      if (req.method === 'PROPFIND') {
        if (!fs.existsSync(item.full)) { send(404, 'Not found'); return; }
        const stat = fs.statSync(item.full), members = [properties(item.relative, stat)];
        if (req.headers.depth !== '0' && stat.isDirectory()) {
          for (const name of fs.readdirSync(item.full)) { const child = target(mount + [item.relative, name].filter(Boolean).join('/')); members.push(properties(child.relative, fs.statSync(child.full))); }
        }
        send(207, `<?xml version="1.0"?><D:multistatus xmlns:D="DAV:">${members.join('')}</D:multistatus>`, { 'Content-Type': 'application/xml; charset=utf-8' }); return;
      }
      if (req.method === 'MKCOL') {
        if (fs.existsSync(item.full)) { send(405, 'Collection already exists'); return; }
        if (!fs.existsSync(path.dirname(item.full))) { send(409, 'Parent collection missing'); return; }
        fs.mkdirSync(item.full); send(201); return;
      }
      if (req.method === 'LOCK') {
        let lock = locks.get(item.relative);
        if (lock && !String(req.headers.if ?? '').includes(lock.token)) { send(423, 'Resource locked'); return; }
        if (!lock) {
          if (!fs.existsSync(path.dirname(item.full))) { send(409, 'Parent collection missing'); return; }
          lock = { token: `opaquelocktoken:${randomUUID()}`, createdNull: !fs.existsSync(item.full) }; locks.set(item.relative, lock);
          if (lock.createdNull) fs.writeFileSync(item.full, Buffer.alloc(0), { flag: 'wx' });
        }
        send(200, lockDocument(lock.token), { 'Content-Type': 'application/xml; charset=utf-8', 'Lock-Token': `<${lock.token}>` }); return;
      }
      if (req.method === 'UNLOCK') {
        const lock = locks.get(item.relative);
        if (!lock || req.headers['lock-token'] !== `<${lock.token}>`) { send(409, 'Unknown lock token'); return; }
        locks.delete(item.relative);
        if (lock.createdNull && fs.existsSync(item.full) && fs.statSync(item.full).size === 0) fs.unlinkSync(item.full);
        send(204); return;
      }
      if (req.method === 'PUT') {
        permittedWrite(item.relative, req);
        if (!fs.existsSync(path.dirname(item.full))) { send(409, 'Parent collection missing'); return; }
        const existed = fs.existsSync(item.full); fs.writeFileSync(item.full, body); send(existed ? 204 : 201); return;
      }
      if (req.method === 'MOVE') {
        if (!req.headers.destination) { send(400, 'Destination required'); return; }
        const destination = target(req.headers.destination); permittedWrite(item.relative, req); permittedWrite(destination.relative, req);
        if (!fs.existsSync(item.full)) { send(404, 'Source missing'); return; }
        if (!fs.statSync(item.full).isFile()) { send(405, 'Only file MOVE supported'); return; }
        if (fs.existsSync(destination.full)) {
          if (req.headers.overwrite !== 'T' || !fs.statSync(destination.full).isFile()) { send(412, 'Overwrite refused'); return; }
          fs.unlinkSync(destination.full);
        }
        fs.renameSync(item.full, destination.full); entry.destination = destination.relative; send(201); return;
      }
      if (req.method === 'DELETE') { permittedWrite(item.relative, req); if (fs.statSync(item.full).isDirectory()) fs.rmdirSync(item.full); else fs.unlinkSync(item.full); send(204); return; }
      send(405, 'Method not implemented by fixture');
    } catch (error) {
      failures.push({ method: req.method, path: entry.path, code: error.code ?? null, message: error.message });
      if (!res.headersSent) send(error.status ?? (error.code === 'ENOENT' ? 404 : 500), error.message); else res.destroy(error);
    }
  });
  server.requestTimeout = 30000; server.headersTimeout = 30000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { url: origin + mount, requests, failures, locks, address: server.address(), async close() { const closed = new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); server.closeAllConnections(); await closed; } };
}
