# Repository Guidelines

## Project Structure & Module Organization
- `src/`: TypeScript app sources (`controllers/`, `core/`, `index.{ts,html,css}`). Builds to `public/`.
- `module/`: NPM module wrapper that exposes the app’s `html`, `css`, and `js` strings. Builds to `dist/`.
- `public/`: Dev build output served locally; place `settings.json`, `scene.compressed.ply`, and assets here for testing.
- `dist/`: ESM bundle and type definitions for publishing.
- Config: `rollup.config.mjs`, `tsconfig.json`, `eslint.config.mjs`. Node ≥ 18.

## Build, Test, and Development Commands
- `npm run develop`: Watch + local server (serves `public/`). Opens at `http://localhost:3000`.
- `npm run build`: Build web app to `public/` and package to `dist/`.
- `npm run watch`: Incremental rebuild to `public/`.
- `npm run serve`: Serve `public/` statically.
- `npm run lint` / `npm run lint:fix`: Lint TypeScript and config files; auto-fix where possible.
- `npm run type:check`: TypeScript type checking only.
- `npm run publint`: Validate publishability of the package.
Example for subpath deploys: `BASE_HREF=/viewer/ npm run build`.

## Coding Style & Naming Conventions
- **Language**: TypeScript + ES modules.
- **Indentation**: 4 spaces; keep lines readable and focused.
- **Filenames**: kebab-case (`data-migrations.ts`, `viewer.ts`).
- **Symbols**: `PascalCase` for classes/types, `camelCase` for variables/functions, `SCREAMING_SNAKE_CASE` for constants.
- **Linting**: Follow `@playcanvas/eslint-config`. Run `npm run lint` before pushing.

## Testing Guidelines
- No automated tests are configured. Provide a brief manual test plan in PRs.
- Local verify: `npm run develop`, then test URL params like `?content=./scene.compressed.ply&settings=./settings.json&noui`.
- Include screenshots/GIFs for UI-affecting changes.

## Commit & Pull Request Guidelines
- **Commits**: Prefer Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`). Keep messages imperative and scoped.
- **PRs**: Include a clear description, linked issues, manual test steps, and screenshots when applicable. Ensure `lint`, `type:check`, and `build` pass.

## Security & Configuration Tips
- App is a static site—do not commit secrets. Assets are fetched with anonymous CORS; host with permissive headers if loading external images.
- Large binaries should not be committed; use releases or external storage when practical.
