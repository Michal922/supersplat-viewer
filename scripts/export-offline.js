// scripts/export-offline.js
// Tworzy samodzielny plik HTML z wbudowanym viewerem i konkretnym splatem.
//
// Użycie: npm run export

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Tu wskazujesz, który plik splata ma być osadzony (względem folderu `public/`)
const MODEL_PATH = "./my_splat_files/me_grzesiek.ply";
// np. const MODEL_PATH = "./my_splat_files/biker.ply";

const projectRoot = path.join(__dirname, "..");
const publicDir  = path.join(projectRoot, "public");
const offlineDir = path.join(projectRoot, "offline");

if (!fs.existsSync(offlineDir)) {
    fs.mkdirSync(offlineDir);
}

// Pliki wygenerowane przez `npm run build`
const htmlPath = path.join(publicDir, "index.html");
const cssPath  = path.join(publicDir, "index.css");
const jsPath   = path.join(publicDir, "index.js");

// Wczytujemy treść
let htmlContent = fs.readFileSync(htmlPath, "utf8");
const cssContent = fs.readFileSync(cssPath, "utf8");
const jsContent  = fs.readFileSync(jsPath, "utf8");

// 1. CSS inline (zamiast <link rel="stylesheet" href="./index.css">)
const cssLinkRegex = /<link\s+rel=["']stylesheet["']\s+href=["']\.\/index\.css["']\s*>\s*/i;
htmlContent = htmlContent.replace(
    cssLinkRegex,
    `<style>\n${cssContent}\n</style>\n`
);

// 2. JS inline (zamiast <script type="module" src="./index.js"></script>)
const jsScriptRegex = /<script\s+type=["']module["']\s+src=["']\.\/index\.js["']\s*><\/script>\s*/i;
htmlContent = htmlContent.replace(
    jsScriptRegex,
    `<script type="module">\n${jsContent}\n</script>\n`
);

// 3. Wczytaj plik splata i zakoduj jako base64
const modelFilePath = path.join(publicDir, MODEL_PATH);
if (!fs.existsSync(modelFilePath)) {
    console.error(`❌ Nie znaleziono pliku modelu: ${modelFilePath}`);
    process.exit(1);
}
const modelBuffer = fs.readFileSync(modelFilePath);
const modelBase64 = modelBuffer.toString("base64");

// 4. Zamień "contents: fetch(contentUrl)," na wersję offline
const originalSnippet = "contents: fetch(contentUrl),";
if (!htmlContent.includes(originalSnippet)) {
    console.error("❌ Nie znaleziono fragmentu 'contents: fetch(contentUrl),' w index.html");
    process.exit(1);
}

const offlineSnippet = `
            contents: (async () => {
                const base64 = "${modelBase64}";
                const binaryString = atob(base64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes.buffer], { type: "application/octet-stream" });
                return new Response(blob);
            })(),
`;
htmlContent = htmlContent.replace(originalSnippet, offlineSnippet);

// 5. (Opcjonalnie) osadź settings.json jako data: URI, jeśli istnieje
const settingsPath = path.join(publicDir, "settings.json");
if (fs.existsSync(settingsPath)) {
    const settingsBuffer = fs.readFileSync(settingsPath);
    const settingsBase64 = settingsBuffer.toString("base64");
    const settingsDataUri = `data:application/json;base64,${settingsBase64}`;
    const settingsRegex = /\.\/settings\.json/g;
    htmlContent = htmlContent.replace(settingsRegex, settingsDataUri);
}

// 6. Zapisz gotowy HTML
const outputPath = path.join(offlineDir, "viewer_offline.html");
fs.writeFileSync(outputPath, htmlContent, "utf8");
console.log(`✅ Wygenerowano plik offline: ${outputPath}`);