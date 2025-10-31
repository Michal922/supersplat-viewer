# SuperSplat Viewer – szybki start (HTTP/HTTPS + iOS)

Ten dokument prowadzi „od zera” do uruchomienia viewer’a:
- **HTTP** (jak w referencyjnym repo) – desktop/Android.
- **HTTPS** z własnym CA – iPhone (wymagane do czujników/sensorów).
- Jeden workflow „dualny”: oba serwery startują jedną komendą.

---

## 1) Minimalny serwer statyczny (alternatywy)

### Python
```sh
python3 -m http.server 8000
# → http://localhost:8000
```

### Node – `serve`
```sh
npx serve
# → http://localhost:3000
```

> U nas używamy `serve` również w skryptach NPM (patrz sekcja „Komendy”).

---

## 2) Debugger (Chrome + VS Code)

1. Uruchom serwer (np. `npx serve` albo `npm run serve`).
2. W VS Code dodaj `launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "//": "Dopasuj port do tego, co drukuje 'serve' (zwykle 3000)",
      "type": "pwa-chrome",
      "request": "launch",
      "name": "Chrome: my_splat (serve)",
      "url": "http://localhost:3000/index.html",
      "webRoot": "${workspaceFolder}/my_splat_testdir_project"
    }
  ]
}
```

---

## 3) Jak sprawdzić IP hosta (LAN)

Linux:
```sh
networkctl status
# Szukaj adresu w rodzaju 192.168.x.x lub 172.20.x.x
```

macOS:
```sh
ipconfig getifaddr en0   # Wi-Fi
ipconfig getifaddr en7   # (inne interfejsy zależnie od sprzętu)
```

Windows (PowerShell):
```ps1
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -match "Wi-Fi"}
```

---

## 4) Sensory w desktopowym Chrome (symulacja)

DevTools → `⌘⌥I` / `Ctrl+Shift+I` → Command Menu (`⌘P`/`Ctrl+P`) → wpisz **Sensors** → zakładka **Sensors**.
Możesz tam sterować „Orientation” (α/β/γ).

---

## 5) URUCHAMIANIE (projekt)

### 5.1. Klasyczny tryb (HTTP – tak jak w referencyjnym repo)
```sh
npm install
npm run build
npm run serve
# → http://localhost:3000  (Network: http://<Twoje_IP>:3000)
```

### 5.2. iPhone (HTTPS + czujniki, brak warningów po zaufaniu CA)

**Jednorazowo na zmianę IP:**
```sh
npm run gen-cert -- <Twoje_IP_w_LAN>
# wygeneruje: certs/server.pem, certs/server.key, public/rootCA.cer
```

**Start w trybie DUAL (HTTP+HTTPS jednocześnie):**
```sh
npm run serve-dual
# HTTP : http://localhost:3000 (desktop/Android)
# HTTPS: https://<Twoje_IP>:3443 (iPhone)
# Setup: https://<Twoje_IP>:3443/setup  (pobranie CA)
```

**Na iPhonie:**
1. Wejdź na `https://<Twoje_IP>:3443/setup` i **pobierz `rootCA.cer`**.
2. Zainstaluj profil i **włącz pełne zaufanie**:
   Ustawienia → **Ogólne** → **Informacje** → **Ustawienia zaufania certyfikatów** → włącz dla *Supersplat 3D Local Dev CA*.
3. Otwórz viewer: `https://<Twoje_IP>:3443/`.

> Jeśli wymienisz router lub zmieni się IP komputera – wykonaj ponownie `npm run gen-cert -- <NOWE_IP>`.

---

## 6) FAQ

### „Po co HTTPS tylko dla iPhone?”
iOS wymaga bezpiecznego połączenia (origin *secure*) do udostępniania czujników (Device Orientation). Android/desktop działają na HTTP, więc utrzymujemy stary, szybki workflow i **dodatkowo** wystawiamy HTTPS.

### „Czy DUAL spowalnia?”
Nieznacznie (dwa gniazda serwera). Viewer i PlayCanvas działają identycznie; to tylko warstwa serwowania plików. CPU/GPU renderingu bez zmian.

### „Gdzie są certyfikaty?”
`certs/server.pem`, `certs/server.key`, `public/rootCA.cer`. Są ignorowane przez Git (`.gitignore`).

---

## 7) Przydatne linki

- Model Viewer: <https://playcanvas.com/model-viewer>
- Edytor (przykład):  
  <https://superspl.at/editor?load=https://raw.githubusercontent.com/willeastcott/assets/main/biker.ply>
- Pretrained 3DGS:  
  <https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/datasets/pretrained/models.zip>
- Konwersja PLY → .splat:  
  <https://github.com/antimatter15/splat/blob/main/convert.py>

---

## 8) Różnica: `npm run develop` vs `npx serve`

- `npm run develop` – **projektowa** komenda (u nas: `rollup -w` + serwer).  
- `npx serve` – prosty serwer statyczny bieżącego katalogu.

W tym repo:
```
watch      → rollup -c -w
serve      → HTTP (public, 3000)
serve-https→ HTTPS (3443) dla gotowych certów
serve-dual → HTTP (3000) + HTTPS (3443) naraz
```

---

## 9) Przykłady URL

- Lokalnie (desktop/Android):  
  `http://localhost:3000/?content=...&settings=...`
- iPhone (po zaufaniu CA):  
  `https://<Twoje_IP>:3443/?content=...&settings=...`
