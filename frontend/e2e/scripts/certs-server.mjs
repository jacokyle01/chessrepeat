// Stand-in for Google's securetoken cert endpoint.
//
// Generates a throwaway RSA key + self-signed x509 cert (openssl) into
// e2e/.tmp, then serves {"e2e": "<cert PEM>"} the way Google does — the
// Go server, started with FIREBASE_CERTS_URL pointing here, verifies ID
// tokens against it. Tests sign their tokens with the private key
// (e2e/support/auth.ts). Nothing here is reachable outside localhost.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.E2E_CERTS_PORT || 8090);
const tmp = join(dirname(fileURLToPath(import.meta.url)), '..', '.tmp');
mkdirSync(tmp, { recursive: true });

const keyPath = join(tmp, 'key.pem');
const certPath = join(tmp, 'cert.pem');
execFileSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', keyPath, '-out', certPath,
  '-subj', '/CN=chessrepeat-e2e', '-days', '1',
], { stdio: 'ignore' });

const body = JSON.stringify({ e2e: readFileSync(certPath, 'utf8') });

createServer((_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(body);
}).listen(port, '127.0.0.1', () => {
  console.log(`e2e certs server on http://localhost:${port}/ (key: ${keyPath})`);
});
