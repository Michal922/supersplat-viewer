# SuperSplat Viewer – dokumentacja źródeł (src/) + nowy tryb DUAL

Ten dokument opisuje strukturę TypeScript w `src/` (bez zmian względem referencji) **oraz** nowe elementy toolingu, które dodają obsługę iOS (HTTPS + strona `/setup`) przy zachowaniu dotychczasowego workflow HTTP.

## Spis treści
- App bootstrap i UI: `src/index.ts`
- Viewer i kamera: `src/viewer.ts`
- Wejścia (klawiatura/mysz/touch/gamepad): `src/input.ts`
- Animacje i splajny: `src/controllers/anim-controller.ts`, `src/core/spline.ts`, `src/core/math.ts`
- Stan reaktywny i migracje: `src/observe.ts`, `src/data-migrations.ts`
- Picking: `src/picker.ts`
- HTML i pomost czujników: `src/index.html`
- **Nowy tooling (poza `src/`):** `scripts/gen-cert-openssl.sh`, `scripts/serve-dual.js`, `public/setup/index.html`
- **Komendy NPM i uruchamianie** (HTTP/HTTPS)

> **Uwaga:** Kod runtime (viewer, sterowanie, UI) pozostał taki sam. Nowości dotyczą wyłącznie **sposobu serwowania** (dualny serwer) i **konfiguracji certyfikatów** dla iOS.

---

## src/index.ts (bootstrap + UI wiring)
- Inicjuje aplikację PlayCanvas, ładuje zawartość (gsplat), tworzy `Viewer`.
- Zarządza stanem (obserwowalny proxy), zdarzeniami i XR.
- Wiąże UI z akcjami: fullscreen, jakość, tryby kamery (orbit/fly/anim), AR/VR, info, reset/frame, timeline.
- Pobiera ustawienia z parametrów URL (`?content=...&settings=...`).
- Render on-demand (`autoRender=false`) – renderuje, gdy trzeba (zmiany kamery/PROJ, ministats aktywne).

## src/viewer.ts (render + kamera + blending)
- Konfiguruje trzy kontrolery: **Orbit**, **Fly**, **Anim**.
- Płynne przejścia i miks pozy/focusu.
- Picking (double-click) do refokusowania orbit.
- Integracja czujników urządzenia:
  - Jeśli `window.sse.orientationEnabled`, Viewer na każdej klatce pobiera delty z mostka w `index.html`
  - Przelicza je na obroty orbit i dodaje do `frame.deltas.rotate`
  - Zapisuje „applied deg” do UI (telemetria orientacji).

## src/input.ts (agregacja wejść)
- Desktop: WASD/QE, mysz (pan/zoom/rotate), wheel-zoom.
- Touch: jedno- i wielodotyk (pan, pinch-zoom), dual-gesture joystick dla fly.
- Gamepad: lewa gałka – ruch, prawa – obrót.
- Każda klatka generuje `InputFrame` z deltas `{move, rotate}`; kontrolery konsumują to w `update()`.

## src/controllers/anim-controller.ts, src/core/spline.ts, src/core/math.ts
- Animacja kamery po splajnie Hermite’a, kursory czasu (`repeat`/`pingpong`), easing, pomocnicza matematyka.

## src/observe.ts, src/data-migrations.ts
- Reaktywny stan (proxy + zdarzenia `'<prop>:changed'`).
- Migracje ustawień (np. normalizacja `frameRate` torów animacji).

## src/picker.ts
- Odczyt głębi z bufora pickingowego i rekonstrukcja pozycji 3D dla fokusa orbit.

## src/index.html (UI + mostek czujników)
- Zawiera pełny UI (`#ui`) oraz **mostek Device Orientation**:
  - Rejestruje `deviceorientation`, zlicza Δβ/Δγ do `window.sse.orientationDelta`.
  - Na iOS prosi o uprawnienie (klik przycisku → `DeviceOrientationEvent.requestPermission()`).
  - Pętla rAF aktualizuje pole telemetryczne (deg zastosowane w Viewer).

---

## Nowy tooling (poza `src/`)

### `scripts/gen-cert-openssl.sh`
- Generuje **lokalne CA** (root) + **cert serwera** z SAN: `localhost`, `127.0.0.1`, **`<Twoje_IP_w_LAN>`**.
- Artefakty:
  - `certs/server.pem` – cert serwera
  - `certs/server.key` – klucz serwera
  - `public/rootCA.cer` – cert CA w formacie DER do **instalacji na iOS/Android**
- Uruchomienie (za każdym razem, gdy zmieni się IP hosta):
```sh
npm run gen-cert -- <Twoje_IP_w_LAN>
```

### `scripts/serve-dual.js`
- Startuje **dwa** serwery równolegle:
  - **HTTP** na porcie `3000` (jak w referencji) → desktop/Android.
  - **HTTPS** na porcie `3443` (z wygenerowanymi certami) → iPhone.
- Loguje przejrzysty banner z adresami, używa `morgan` do logów żądań (statusy/latencje).

### `public/setup/index.html`
- Prosta strona „Setup” pod `https://<IP>:3443/setup`:
  - Plik do pobrania: `rootCA.cer`
  - Instrukcja: instalacja profilu + **włączenie pełnego zaufania** w iOS.
  - Link startowy do viewer’a po HTTPS.

---

## Komendy NPM (skróty)

```json
{
  "serve": "serve public -C -l 3000",
  "serve-https": "serve public -C --ssl-cert ./certs/server.pem --ssl-key ./certs/server.key -l 3443",
  "serve-dual": "node scripts/serve-dual.js",
  "gen-cert": "bash ./scripts/gen-cert-openssl.sh",
  "develop": "concurrently --kill-others \"npm run watch\" \"npm run serve\"",
  "develop-https": "concurrently --kill-others \"npm run watch\" \"npm run serve-https\"",
  "develop-dual": "concurrently --kill-others \"npm run watch\" \"npm run serve-dual\""
}
```

### Scenariusze
- **Desktop/Android (jak dawniej, HTTP):**
  ```sh
  npm install
  npm run build
  npm run serve
  # http://localhost:3000
  ```
- **iPhone (HTTPS):**
  ```sh
  npm run gen-cert -- <IP>
  npm run serve-dual
  # Setup:  https://<IP>:3443/setup  (pobierz rootCA.cer, zaufaj CA)
  # Viewer: https://<IP>:3443/
  ```
- **Dev (watch + serwer):**
  ```sh
  npm run develop        # HTTP
  npm run develop-https  # HTTPS
  npm run develop-dual   # HTTP+HTTPS
  ```

---

## Uwagi wydajnościowe
- Render/CPU/GPU viewer’a bez zmian – to te same pliki.
- Reżim DUAL to dwa gniazda serwera (statyki). Overhead ~pomijalny.
- Setki jednoczesnych klientów mogą obciążyć łącze/IO – w LAN zwykle OK.

---

## Porządek w repo
- `certs/` i artefakty (`server.pem`, `server.key`) są lokalne; **nie commitujemy**.
- `public/rootCA.cer` generowany automatycznie; również nie commituj w repo publicznym.
- Przy zmianie IP: uruchom ponownie `npm run gen-cert -- <NOWE_IP>`.

---

## Bezpieczeństwo
- CA i klucze są **tylko do dev** i pozostają na Twojej maszynie.
- Nie używaj ich w środowisku produkcyjnym.
- Nie udostępniaj `rootCA.cer` publicznie (poza testowymi urządzeniami w Twojej sieci).
