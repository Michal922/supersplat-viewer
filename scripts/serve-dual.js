// scripts/serve-dual.js
// Dependency-free dual server launcher using `npx serve` for both HTTP and HTTPS.
// Works even if `express`/`morgan` are not installed.
//
// Usage: `node scripts/serve-dual.js`
// Requires: the `serve` CLI (automatically resolved by `npx`)

import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const CERT_DIR = path.join(ROOT, "certs");

const HTTP_PORT = Number(process.env.HTTP_PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);

// Resolve LAN IP (best-effort)
function getLanIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (!iface.internal && iface.family === "IPv4") {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function ensurePublic() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error(`✖ Missing ${PUBLIC_DIR}. Build first: "npm run build"`);
    process.exit(1);
  }
}

function runServeHTTP() {
  const args = ["serve", PUBLIC_DIR, "-C", "-l", String(HTTP_PORT)];
  const child = spawn("npx", args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`HTTP server exited with code ${code}`);
    }
    process.exit(code ?? 0);
  });
  return child;
}

function runServeHTTPS() {
  const certPath = path.join(CERT_DIR, "server.pem");
  const keyPath = path.join(CERT_DIR, "server.key");
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.error("✖ Brak certyfikatów. Uruchom najpierw:");
    console.error("  npm run gen-cert -- <TWOJE_IP_W_LAN>");
    process.exit(1);
  }

  const args = [
    "serve",
    PUBLIC_DIR,
    "-C",
    "--ssl-cert",
    certPath,
    "--ssl-key",
    keyPath,
    "-l",
    String(HTTPS_PORT),
  ];
  const child = spawn("npx", args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`HTTPS server exited with code ${code}`);
    }
    process.exit(code ?? 0);
  });
  return child;
}

function printBanner() {
  const LAN_IP = getLanIP();
  // ensure /setup exists (helpful copy)
  const setupDir = path.join(PUBLIC_DIR, "setup");
  if (!fs.existsSync(setupDir)) fs.mkdirSync(setupDir, { recursive: true });

  const banner = `
┌──────────────────────────────────────────────┐
│              DUAL SERVER RUNNING             │
├──────────────────────────────────────────────┤
│  HTTP   (desktop/Android):                   │
│    • http://localhost:${HTTP_PORT}                         │
│    • http://${LAN_IP}:${HTTP_PORT}                        │
│                                              │
│  HTTPS (iPhone sensors):                     │
│    • https://${LAN_IP}:${HTTPS_PORT}                     │
│  Setup (CA):                                  │
│    • https://${LAN_IP}:${HTTPS_PORT}/setup               │
├──────────────────────────────────────────────┤
│ Hints:                                       │
│  - If HTTPS fails on iPhone:                 │
│      1) open /setup, install rootCA.cer      │
│      2) Settings → General → About →         │
│         Certificate Trust Settings → enable  │
│         full trust for the CA                │
│  - Re-run gen-cert when your LAN IP changes  │
└──────────────────────────────────────────────┘
`;
  console.log(banner);
}

function main() {
  ensurePublic();
  printBanner();
  const http = runServeHTTP();
  const https = runServeHTTPS();

  // Keep process alive while children run
  const shutdown = () => {
    http && http.kill("SIGTERM");
    https && https.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();