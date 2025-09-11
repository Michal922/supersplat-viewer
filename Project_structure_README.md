SuperSplat Viewer – Source Documentation

This document provides an overview of the TypeScript source files under `src/`, focusing on classes, responsibilities, and key methods. It also explains how UI controls in `src/index.html` are wired, and details all camera-orientation logic across sensors, keyboard, mouse, touch, and gamepad.

**Contents**
- App bootstrap and UI wiring: `src/index.ts`
- Viewer and camera management: `src/viewer.ts`
- Input aggregation and mapping: `src/input.ts`
- Animation controller and splines: `src/controllers/anim-controller.ts`, `src/core/spline.ts`, `src/core/math.ts`
- State observation and migrations: `src/observe.ts`, `src/data-migrations.ts`
- Picking: `src/picker.ts`
- HTML UI and device orientation bridge: `src/index.html`

---

**src/index.ts**

- Purpose: Bootstraps the app, loads content/settings, initializes XR and the `Viewer`, and wires all UI controls found in `index.html`.

- Top-level helpers:
  - `initPoster(events)`: Shows a blurred poster during load; fades out on first frame.
  - `initXr(app, cameraElement, state, events)`: Sets up AR/VR availability flags, session start/end, and camera rig transforms for XR. Also switches render clear color in AR.
  - `loadContent(app)`: Creates and loads the `gsplat` `Asset`, and adds it to the scene under an entity named `gsplat` once loaded.
  - `waitForGsplat(app, state)`: Awaits the `gsplat` asset and updates `state.progress` during streaming.

- App bootstrap (`DOMContentLoaded` handler):
  - Configures PlayCanvas shader chunks (skybox and picking) and anonymous CORS for textures.
  - Loads the skybox if provided via URL param.
  - Creates `events` (`EventHandler`) and `state` (via `observe`) with reactive flags:
    - `cameraMode: 'orbit' | 'anim' | 'fly'`, `hqMode`, `uiVisible`, XR availability, animation timeline fields, fullscreen, etc.
  - Instantiates `Viewer` and calls `initialize()` after the `gsplat` asset is ready.

- UI wiring (by element `id`, see `index.html`):
  - Fullscreen: `enterFullscreen`, `exitFullscreen` toggle fullscreen, including a fallback via `postMessage` to parent.
  - Quality: `low`, `high` set `state.hqMode` and update `#qualityToggleHighlight`.
  - Orientation toggle: `orientationOff`, `orientationOn` flip `window.sse.orientationEnabled` and update `#orientationToggleHighlight`.
  - AR/VR: `arMode`, `vrMode` fire `events` (`'startAR'`, `'startVR'`) which `initXr` handles.
  - Info panel: `info` toggles the panel; `desktopTab` / `touchTab` swap the visible help; panel closes on background pointerdown.
  - Settings panel: `orbitSettings` / `flySettings` toggle panel visibility; `orbit` / `fly` set `state.cameraMode`.
  - View actions: `reset`, `frame` dispatch `events.fire('inputEvent', 'reset'|'frame')` consumed by `Viewer`.
  - Animation: `play`, `pause` set `cameraMode='anim'` and toggle `state.animationPaused`; timeline scrubber updates via `events.fire('setAnimationTime', t)`.
  - Touch joystick: Reacts to `events.on('touchJoystickUpdate', ...)` to position the on-screen joystick.
  - UI fading: Any `inputEvent` shows UI for 4s, then fades. `interrupt` and `cancel` also close panels.

- Input event dispatch to Viewer:
  - Canvas listeners for `wheel`, `pointerdown`, `contextmenu`, `keydown` fire `events.fire('inputEvent', 'interrupt', ev)`.
  - `pointermove` fires `inputEvent: 'interact'`.
  - Double-tap emulation on touch (iOS) fires `inputEvent: 'dblclick'`.
  - Global `keydown` maps: `Escape → 'cancel'`, `f → 'frame'`, `r → 'reset'`, `Space → 'playPause'`.

---

**src/viewer.ts**

- Purpose: Orchestrates rendering, camera controllers, smooth transitions, device-orientation integration, picking, and first-frame readiness.

- Key free function:
  - `createRotateTrack(initial: Pose, keys = 12, duration = 20)`: Synthesizes a simple orbit animation around the current focus target.

- Class: `Viewer`
  - Responsibilities:
    - Configures camera defaults (background color, FOV, horizontalFov on resize), and render triggering (detect world/projection matrix changes to set `app.renderNextFrame`).
    - Creates three camera controllers: `OrbitController`, `FlyController`, and optionally `AnimController` from settings or a generated rotate track.
    - Maintains an active camera `Pose` (`activePose`) and smooth transitions between camera modes.
    - Integrates user input via `AppController.frame` (see `input.ts`).
    - Consumes device-orientation deltas and publishes applied deltas for UI.
    - Handles double-click picking to re-focus the orbit camera.
    - Signals load progress readiness and first-frame completion.

  - Constructor(app, entity, events, state, settings, params):
    - Disables `app.autoRender` and sets up responsive FOV and render-change detection.
    - Applies HQ mode pixel ratio changes on `hqMode:changed`.

  - `initialize()`:
    - Locates the loaded `gsplat` component and derives the scene bounds.
    - Chooses start poses: a frame pose (fit to bounds), a reset pose (from settings), and a user start pose.
    - Instantiates controllers:
      - `OrbitController`: constrained pitch, damping for rotate/move/zoom.
      - `FlyController`: constrained pitch, damping for rotate/move.
      - `AnimController` (optional): from settings track, or an auto-generated rotate track for object-centric experiences.
    - Creates `AppController` and sets `moveSpeed` based on scene size.
    - Registers event handlers:
      - `events.on('inputEvent', ...)`: handles `frame`/`reset` to reattach orbit pose, and `cancel`/`interrupt` to exit animation.
      - `app.on('update', ...)`: the main tick:
        - Skips updates in XR.
        - Calls `controller.update(dt, state, activePose.distance)` to accumulate per-frame deltas from all inputs.
        - Device orientation: Reads `window.sse.orientationDelta` if `orientationEnabled` and not in fly mode. On significant input, switches to orbit, scales by `controller.orbitSpeed * 2.0 * dt`, and appends to `frame.deltas.rotate`. Resets the consumed deltas to zero.
        - Emits `touchJoystickUpdate` (for on-screen joystick) in fly mode.
        - Advances the active camera controller (`Orbit`, `Fly`, or `Anim`) with proper `dt` (paused or during transition).
        - Smoothly blends from previous camera during transitions using `easeOut`.
        - Applies pose to the camera entity and publishes per-frame applied orbit deltas (deg) to `window.sse.orientationAppliedDeg` for the UI.
      - Camera mode switching: On `cameraMode:changed`, detaches the previous controller, attaches the new one, and resets transition timing unless snapping.
      - Animation scrubbing: On `setAnimationTime`, sets the animation cursor and ensures `cameraMode='anim'`.
      - Double-click pick: On `dblclick`, computes a world-space hit via `Picker`, switches to orbit, preserves distance, and focuses the orbit controller on the picked point.
    - Sorting readiness: Waits for the first gsplat sort update, marks `state.readyToRender = true`, and fires `firstFrame` (also `window.firstFrame?.()`).

---

**src/input.ts**

- Purpose: Aggregate input across desktop (keyboard+mouse), touch (multi-touch and dual-gesture), and gamepad; convert to a unified `InputFrame` consumed by camera controllers.

- Free helper:
  - `screenToWorld(camera, dx, dy, dz, out?)`: Converts 2D screen deltas into a world-space pan vector. Handles perspective/orthographic projection by using FOV, aspect, and `orthoHeight`. Used to pan at the current target distance `dz`.

- Class: `AppController`
  - State and sources:
    - `_desktopInput: KeyboardMouseSource`, `_orbitInput: MultiTouchSource`, `_flyInput: DualGestureSource`, `_gamepadInput: GamepadSource`.
    - `_state`: accumulates axis (WASD/E/Q + arrows), mouse buttons, modifier keys, and current touch-count.
    - `frame: InputFrame<{ move: [x,y,z], rotate: [x,y,z] }>`: The per-tick accumulation buffer read by controllers.
    - `joystick`: exposes base/stick positions for the on-screen joystick UI.
  - Tunables: `moveSpeed` (set by `Viewer` from scene size), `orbitSpeed`, `pinchSpeed`, `wheelSpeed`.
  - `constructor(element, camera)`: Attaches the input sources to the provided element (canvas). Listens to `DualGestureSource` joystick events to update `joystick`.
  - `update(dt, state, distance)`: Core mapping per tick:
    - Mode switching: Any non-zero keyboard axis while not in fly mode switches to `cameraMode='fly'` and sets `state.snap=true` (transition without blend).
    - Mode flags: `orbit = +(state.cameraMode==='orbit')`, `fly = +(state.cameraMode==='fly')`, `double = +(touches>1)`, `pan = MMB or RMB-down or multitouch`.
    - Desktop move: normalized keyboard axis scaled by `moveSpeed` and `dt` with SHIFT×2, CTRL×0.5; pan from `screenToWorld(mouse.dx,mouse.dy,distance)` when `pan`; wheel zoom on Z with `wheelSpeed`.
    - Desktop rotate: mouse deltas scaled by `orbitSpeed`, `dt` and `orbitFactor` (FOV-based when in fly mode). Rotation suppressed while panning.
    - Touch move: pan from one-finger drag in orbit+panning; fly move from left dual-gesture; pinch zoom when multitouch in orbit.
    - Touch rotate: one-finger drag for orbit rotation; right dual-gesture for fly rotation.
    - Gamepad: left stick → move (X/Z), right stick → rotate (X/Y).
    - Frame write: Appends to `frame.deltas.move` and `frame.deltas.rotate`. In orbit mode, Z-movement sign is flipped to match orbit semantics.

Camera orientation sources handled here: keyboard/mouse, touch gestures, gamepad. Device sensors are injected by `Viewer` before controllers read the frame (see `viewer.ts`).

---

**src/controllers/anim-controller.ts**

- Purpose: Drive camera animation tracks with looping and spline interpolation.

- Types:
  - `AnimTrack`: Defines keyframe times and `position`/`target` value arrays, plus duration, frameRate, interpolation, and loop mode.

- Class: `AnimCursor`
  - Tracks current time (`cursor`) across `duration` with `loopMode`: `'none'`, `'repeat'`, or `'pingpong'`.
  - `update(dt)`: Advances timers and wraps according to loop mode.
  - `value` getter/setter: Normalized cursor for ping-pong mapping and direct scrubbing.

- Class: `AnimController extends InputController`
  - Members: `spline: CubicSpline`, `cursor: AnimCursor`, `frameRate`, preallocated `result` array, `position`, `target`.
  - `update(frame, dt)`: Discards input, advances `cursor`, evaluates `spline` at `cursor.value * frameRate`, writes `position`/`target`, and returns a `Pose` via `this._pose.look(position, target)`.
  - `static fromTrack(track)`: Builds a concatenated point array `[pos, tgt, pos, tgt, ...]`, creates a looping spline (with optional terminal duplication), and returns an `AnimController` configured to the track.

---

**src/core/spline.ts**

- Purpose: Cubic Hermite spline evaluation for multi-dimensional keyframe data.

- Class: `CubicSpline`
  - `constructor(times, knots)`: `knots` stores triplets per dimension per key: `[m_in, p, m_out]`.
  - `evaluate(time, result)`: Clamps to range or evaluates a segment via `evaluateSegment`.
  - `getKnot(index, result)`: Copies the knot value at an index.
  - `evaluateSegment(segment, t, result)`: Hermite basis evaluation using in/out tangents.
  - `static fromPoints(times, points, tension=0)`: Builds tangents by finite differences (smoothed by `1 - tension`).
  - `static fromPointsLooping(length, times, points, tension=0)`: Duplicates end caps around the range to create a seamless loop.

---

**src/core/math.ts**

- Purpose: Small math utilities.
  - `damp(damping, dt)`: Convert a damping factor to a per-`dt` smoothing factor.
  - `easeOut(x)`: Exponential ease-out in [0,1]. Used for camera transitions.
  - `mod(n, m)`: Positive modulus.

---

**src/observe.ts**

- Purpose: Observable state proxy that emits `'<prop>:changed'` via `EventHandler` when an existing property is set to a new value.
  - Prevents adding new or symbol properties; logs errors on disallowed sets.
  - Used to drive UI updates and internal reactions in `index.ts` and `viewer.ts`.

---

**src/data-migrations.ts**

- Purpose: Migrate settings objects to the current expected schema.
  - Ensures `AnimTrack.frameRate` exists; if missing, assigns a default and scales keyframe `times` accordingly.
  - `migrateSettings(settings)`: Applies migrations to each `animTracks` entry and returns the updated object.

---

**src/picker.ts**

- Purpose: Read a packed-depth pick buffer and reconstruct world-space positions for focus picking.

- Class: `Picker`
  - `constructor(app, camera)`: Lazily constructs a PlayCanvas `Picker` with the canvas size.
  - `async pick(x, y)`: Renders picking to an RT, reads a single pixel, unpacks the float depth, reconstructs clip-space, transforms to view space, then to world space using camera projection and world transforms. Returns `Vec3 | null`.

---

**src/index.html** (UI and device-orientation bridge)

- Structure: Hosts `<pc-app>` and the scene entities (camera rig, light, splat placeholder). Contains the entire UI (`#ui`) including:
  - Loading bar: `#loadingWrap` (`#loadingText`, `#loadingBar`).
  - Buttons toolbar: `#buttonContainer` with `#play`, `#pause`, `#arMode`, `#vrMode`, `#info`, `#orbitSettings`, `#flySettings`, `#enterFullscreen`, `#exitFullscreen`.
  - Settings panel: Camera toggle (`#orbit`, `#fly`, highlight `#cameraToggleHighlight`), Quality (`#low`, `#high`, `#qualityToggleHighlight`), Device Orientation (`#orientationOff`, `#orientationOn`, `#orientationToggleHighlight`), View actions (`#frame`, `#reset`).
  - Info panel: `#infoPanel` with Desktop/Touch tabs and control legends.
  - Touch joystick container: `#joystickBase`/`#joystick`.
  - Orientation readouts: `#orientationBox` shows raw device angles; `#orientationDeltaBox` shows applied orbit deltas per frame.

- Orientation event bridge (inline script):
  - Sets up `window.sse` with `orientationEnabled`, `orientationDelta: { x, y }`, and `orientationAppliedDeg` placeholders.
  - Registers a `deviceorientation` handler (requesting permission on iOS if needed). Each event:
    - Displays raw angles (β=tilt X, γ=tilt Y, α=compass Z).
    - Computes deltas vs. the last event, clamps tiny noise, and accumulates into `window.sse.orientationDelta`:
      - `ax ← Δβ` (mapped to pitch/X), `ay ← Δγ` (mapped to yaw/Y).
      - These deltas are later consumed within `Viewer` and reset to zero each frame.
  - A requestAnimationFrame loop reads `window.sse.orientationAppliedDeg` (set in `Viewer`) and updates `#orientationDeltaBox` so the user sees how much orbit was applied each frame.

---

**Camera Orientation & Controls (All Inputs)**

- Keyboard/Mouse (desktop): Implemented in `AppController.update()`
  - Movement: `W/S` and `Up/Down` → Z; `A/D` and `Left/Right` → X; `Q/E` → Y. Scale by `moveSpeed * dt`, with SHIFT×2 and CTRL×0.5.
  - Rotate (orbit/fly): Mouse drag (LMB) appends to `frame.deltas.rotate` scaled by `orbitSpeed * dt` (and FOV factor in fly mode). Rotation is suppressed while panning.
  - Pan: RMB or MMB drag pans using `screenToWorld(dx, dy, distance)`.
  - Zoom: Mouse wheel modifies Z via `wheelSpeed * dt`.
  - Mode nudging: Any keyboard axis input switches to `cameraMode='fly'` (snap transition).

- Touch (mobile): Implemented in `AppController.update()`
  - Orbit move: One-finger drag panning when `pan` is active in orbit mode.
  - Orbit rotate: One-finger drag rotates when not panning in orbit mode.
  - Zoom: Two-finger pinch in orbit mode, scaled by `pinchSpeed * dt`.
  - Fly move/rotate: Dual-gesture left stick (move X/Z), right stick (look X/Y); joystick UI updated via `events('touchJoystickUpdate')`.

- Gamepad: Implemented in `AppController.update()`
  - Move: Left stick X/Z.
  - Rotate: Right stick X/Y.

- Device Orientation (sensors): Bridged in `index.html` and applied in `Viewer.initialize()` update loop
  - Source: `deviceorientation` events (β, γ, α) → deltas accumulated into `window.sse.orientationDelta` each browser frame when orientation control is enabled.
  - Consumption: On each app update, if not in fly mode and `orientationEnabled !== false`, `Viewer` reads the deltas. If above a small threshold, it:
    - Switches to orbit (snapped) if necessary.
    - Appends `[ox * gain, oy * gain, 0]` to `frame.deltas.rotate`, where `gain = orbitSpeed * 2.0 * dt`.
    - Zeroes `window.sse.orientationDelta` after consuming.
  - Feedback: `Viewer` computes per-frame applied orbit angle changes and writes `window.sse.orientationAppliedDeg`, displayed in `#orientationDeltaBox`.

---

Notes
- Buttons and toggles in `index.html` are “served” by `index.ts` by querying DOM elements by `id`, adding listeners, mutating `state` (observed via `observe()`), and/or firing `events` that `Viewer` or XR helpers consume.
- Rendering is demand-driven: `autoRender=false`. The `Viewer` sets `renderNextFrame=true` on camera or projection changes, and while ministats is active.
- Double-click/tap focus uses packed-depth picking so the orbit camera can snap its focus to a precise world-space point.

