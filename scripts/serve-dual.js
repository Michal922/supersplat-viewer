// scripts/serve-dual.js
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import express from "express";
import morgan from "morgan";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const CERT_DIR = path.join(ROOT, "certs");
const SERVER_CERT = path.join(CERT_DIR, "server.pem");
const SERVER_KEY = path.join(CERT_DIR, "server.key");

const HTTP_PORT = Number(process.env.HTTP_PORT || 3000);   // stary workflow
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443); // iOS (sensors)

function ensureCerts() {
  const ok = fs.existsSync(SERVER_CERT) && fs.existsSync(SERVER_KEY);
  if (!ok) {
    console.error("\nBrak certów. Uruchom najpierw: npm run gen-cert -- <IP>\n");
    process.exit(1);
  }
}

function startHTTP() {
  // identycznie jak u kolegi: `serve public -C -l 3000`
  const ps = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["serve", "public", "-C", "-l", String(HTTP_PORT)],
    { stdio: "inherit" }
  );
  ps.on("exit", (code) => process.exit(code ?? 0));
}

function startHTTPS() {
  ensureCerts();

  const app = express();

  // Ładne logi requestów (statusy, czasy)
  app.use(morgan("dev"));

  // /setup – prosta strona z instrukcją i linkiem do CA
  app.get("/setup", (_, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "setup", "index.html"));
  });

  // Statyki (viewer + wszystko inne)
  app.use(express.static(PUBLIC_DIR));

  const opts = {
    cert: fs.readFileSync(SERVER_CERT),
    key: fs.readFileSync(SERVER_KEY)
  };

  https.createServer(opts, app).listen(HTTPS_PORT, () => {
    // Konkretny, czytelny banner
    console.log(`
  ┌──────────────────────────────────────────────┐
  │              DUAL SERVER RUNNING             │
  ├──────────────────────────────────────────────┤
  │  HTTP   (desktop/Android): http://localhost:${HTTP_PORT}     │
  │                          http://<LAN_IP>:${HTTP_PORT}  │
  │                                              │
  │  HTTPS (iPhone sensors): https://<LAN_IP>:${HTTPS_PORT} │
  │  Setup (CA):           https://<LAN_IP>:${HTTPS_PORT}/setup │
  └──────────────────────────────────────────────┘
`);
  });
}

// uruchamiamy oba na raz
startHTTP();
startHTTPS();