import fs from 'node:fs';
import path from 'node:path';
import { createWebDav } from '../helpers/webdav.mjs';
const text = async (c, args, options) => (await c.git(args, options)).stdout.trim();
export const cases = [{
  id: 'PROTO-006', variant: 'official-http-push-loopback-webdav', title: 'Official legacy HTTP push transfers real objects through a fixture WebDAV endpoint',
  profile: 'N0', tier: 'optional', phase: 'NATIVE_BASELINE', productStatus: 'NOT_ASSESSED', capabilities: ['node'], timeout: 180000,
  async run(c) {
    const execPath = await text(c, ['--exec-path']), helper = path.join(execPath, process.platform === 'win32' ? 'git-http-push.exe' : 'git-http-push');
    const probe = await c.git(['http-push', '-h'], { ok: [0, 1, 129] });
    fs.writeFileSync(path.join(c.artifactDir, 'webdav-provenance.json'), JSON.stringify({ sources: ['https://git-scm.com/docs/git-http-push', 'https://raw.githubusercontent.com/git/git/v2.53.0/http-push.c'], sourceReview: 'Protocol subset: locking_available, lock_remote, remote_ls XML fields, start_put/start_move and unlock_remote. This is not an assertion of exhaustive upstream review.' }, null, 2));
    if (!fs.existsSync(helper) || /not a git command|not built with|no curl support/i.test(probe.stderr + probe.stdout)) return { execution_status: 'ENV_BLOCKED', productStatus: 'NOT_ASSESSED', nonexecution_reason: 'Actual installed Git lacks the legacy http-push helper/WebDAV build; path and executable probe recorded.', limits: ['Help probe is a capability check only; it never supplies functional PASS.'] };
    await c.init();
    const receiver = path.join(c.root, 'dav.git'); await c.git(['init', '--bare', '-b', 'main', receiver]); await c.git(['--git-dir', receiver, 'update-server-info']);
    let server;
    try { server = await createWebDav(receiver); }
    catch (error) { if (['EACCES', 'EPERM', 'EADDRNOTAVAIL'].includes(error.code)) return { execution_status: 'ENV_BLOCKED', productStatus: 'NOT_ASSESSED', nonexecution_reason: `Actual loopback listener probe refused: ${error.code}`, limits: ['No WebDAV or Git transfer execution claimed.'] }; throw error; }
    try {
      c.eq('DAV fixture binds only loopback', server.address.address, '127.0.0.1');
      const args = ['-c', 'protocol.http.allow=always', '-c', 'http.proxy=', 'http-push', '--verbose', server.url, 'refs/heads/main:refs/heads/main'];
      const original = await text(c, ['rev-parse', 'main']); await c.git(args, { timeout: 60000 });
      c.eq('First HTTP push receiver ref', await text(c, ['--git-dir', receiver, 'rev-parse', 'main']), original);
      c.eq('First HTTP push receiver blob', (await c.git(['--git-dir', receiver, 'show', 'main:base.txt'])).stdout, 'base one\n');
      c.write('base.txt', 'committed B over WebDAV\n'); await c.git(['add', 'base.txt']); await c.git(['commit', '-m', 'second DAV commit']);
      const committed = await text(c, ['rev-parse', 'main']); c.write('base.txt', 'staged C stays local\n'); await c.git(['add', 'base.txt']); c.write('base.txt', 'disk D stays local\n');
      const staged = (await c.git(['ls-files', '--stage', '-z'])).stdout; await c.git(args, { timeout: 60000 });
      c.eq('Second HTTP push receiver exact ref', await text(c, ['--git-dir', receiver, 'rev-parse', 'main']), committed);
      c.eq('Receiver commit parent', await text(c, ['--git-dir', receiver, 'rev-parse', 'main^']), original);
      c.eq('Receiver tree excludes local staging', (await c.git(['--git-dir', receiver, 'show', 'main:base.txt'])).stdout, 'committed B over WebDAV\n');
      c.eq('Source index preserved across HTTP push', (await c.git(['ls-files', '--stage', '-z'])).stdout, staged); c.eq('Source disk preserved', c.read('base.txt'), 'disk D stays local\n');
      const clone = path.join(c.root, 'dav-clone'); await c.git(['-c', 'protocol.http.allow=always', '-c', 'http.proxy=', 'clone', server.url, clone], { timeout: 60000 });
      c.eq('Dumb HTTP clone follows real advertised ref', await text(c, ['rev-parse', 'HEAD'], { cwd: clone }), committed);
      c.eq('Clone materializes committed B bytes', fs.readFileSync(path.join(clone, 'base.txt'), 'utf8'), 'committed B over WebDAV\n');
      await c.git(['--git-dir', receiver, 'fsck', '--full']); await c.git(['fsck', '--full'], { cwd: clone });
      for (const method of ['GET', 'PROPFIND', 'MKCOL', 'LOCK', 'PUT', 'MOVE', 'UNLOCK']) c.ok(`Actual HTTP ${method} exercised`, server.requests.some(r => r.method === method && r.status >= 200 && r.status < 300), 'successful real request');
      c.eq('DAV locks released by real Git client', server.locks.size, 0); c.eq('Fixture endpoint had no internal exceptions', server.failures, []);
      return { limits: ['Minimal unauthenticated loopback WebDAV fixture, two real SHA-1 commits and a dumb HTTP clone. No public server, TLS, credentials, all DAV extensions or production WebDAV-server compatibility is certified. Git itself constructs/transfers/verifies all objects and refs; fixture only serves filesystem HTTP operations.'] };
    } finally {
      fs.writeFileSync(path.join(c.artifactDir, 'webdav-requests.json'), JSON.stringify({ requests: server.requests, internalFailures: server.failures, remainingLocks: server.locks.size, listener: '127.0.0.1 ephemeral owned port' }, null, 2)); await server.close();
    }
  },
}];
