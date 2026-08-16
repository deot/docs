# AGENTS.md

## Cursor Cloud specific instructions

This is a **pnpm monorepo** for `@deot/docs`, a Vue 3 documentation toolchain. It contains libraries, a `doc` CLI, and a Vite-powered documentation site; there are no backend services or databases.

### Package layout

| Directory | Package | Responsibility |
|---|---|---|
| `packages/client` | `@deot/docs-client` | Vue application shell and router |
| `packages/cli` | `@deot/docs-cli` | `doc dev` / `doc build` command entry |
| `packages/dever` | `@deot/docs-dever` | Vite dev-server and build implementation used by the CLI |
| `packages/markdown` | `@deot/docs-markdown` | Markdown renderer, highlighting, and `playground` container blocks |
| `packages/playground` | `@deot/docs-playground` | Vue REPL preview and editor UI |
| `packages/renderer` | `@deot/docs-renderer` | V2 flat document protocol, read-only `Renderer`, and visual editor `Combo` |
| `packages/index` | `@deot/docs` | Umbrella package |

The sample documentation workspace is in `site/`; localized content lives under `site/zh-CN` and `site/en-US`.

### Quick reference

| Task | Command |
|---|---|
| Install dependencies | `pnpm install` |
| Lint scripts and Vue/Markdown files | `npm run lint` |
| Fix ESLint issues | `npm run lint:fix` |
| Fix CSS/SCSS style issues | `npm run lint:style` |
| Typecheck | `npm run typecheck` |
| Test all packages | `npm run test -- --package-name '*'` |
| Test one package with coverage | `npm run test -- --package-name '<folder>'` |
| Build one package | `npm run build -- --package-name '<folder>'` |
| Build all packages (known baseline failure; see below) | `npm run build` |
| Serve package examples | `npm run dev` |
| Serve the sample documentation site | `npm run cli:dev` |
| Build the sample documentation site (known baseline failure; see below) | `npm run cli:build` |

Valid package folder names for targeted tests and builds are `cli`, `client`, `dever`, `index`, `markdown`, `playground`, and `renderer`. Use `--include '<pattern>'` for a narrower Vitest run. For example, validate Markdown with `npm run test -- --package-name markdown` and `npm run build -- --package-name markdown`. Tests collect coverage by default. The CI-equivalent checks are typecheck, all-package tests, and build.

### Development notes

- Root commands are implemented by the `ddc` CLI from `@deot/dev`. Run them from the repository root so workspace discovery and the source aliases in `tsconfig.json` work correctly.
- `npm run dev` scans `packages/*/examples` and serves the Markdown and Playground examples. `npm run cli:dev` instead runs this repository's `doc dev` command against the default `site/` workspace. Both are long-running Vite processes.
- Tests use Vitest through `ddc test`. Browser-facing tests normally declare `// @vitest-environment jsdom`; CLI and build tests use the Node environment and dry-run paths so they do not start persistent servers.
- The CLI tests and `cli:*` scripts invoke `tsx`, which creates a local IPC socket. In a restricted sandbox they can fail with `listen EPERM .../tsx-*.pipe`; rerun them with permission to create that socket rather than treating this as a product regression.
- `playground` container blocks in the Markdown package are converted into Playground mount points. Changes to this syntax usually require coordinated tests in both `packages/markdown` and `packages/playground`.
- The Playground loads its live preview dependencies from public CDNs. Unit tests mock those integrations, but manual preview testing requires network access.
- Build configuration treats `client`, `renderer`, `index`, `playground` and `markdown` as Vue packages and externalizes `vue` and `@deot/vc`. Keep package entry points in `src/index.ts` and update the umbrella package dependencies when adding a public package.
- The repository uses tabs for source files and two spaces for JSON, as defined in `.editorconfig`. `npm run lint:style` fixes files in place rather than performing a read-only check.
- `npm run lint` scans the entire working tree, including supported untracked files. If unrelated work makes it fail, preserve that work, report the exact path and diagnostic, and use `pnpm exec eslint <changed-paths...>` for a scoped check; do not present a scoped pass as a full lint pass.
- Husky runs `lint-staged` before commits and `dd-commitlint` for commit messages. Staged Vue files may be rewritten by both Stylelint and ESLint.
- Puppeteer, Canvas, and other native build dependencies are allowed in `pnpm-workspace.yaml`. CI explicitly runs `node node_modules/puppeteer/install.mjs`; run the same command if a browser test reports a missing Chromium installation.
- `package.json` declares `"packageManager": "pnpm@latest"`; pnpm may warn that this is not an exact version. This warning is expected.
- `npm run init:force` removes all installed dependencies and the lockfile. Do not use it for routine setup; prefer `pnpm install`.

### Known baseline issues

- `npm run build` currently includes `client` and `renderer` in `--vue-package`. Declaration generation may still print upstream type warnings from `@deot/vc` and `@vue/repl`; confirm the final per-package `Success` line and absence of `Error! Build failed`.
- A targeted Markdown build currently exits successfully and ends with `@deot/docs-markdown: Success`, but declaration generation prints many upstream diagnostics—some formatted as TypeScript errors—before that summary. Confirm the final per-package `Success` line and absence of `Error! Build failed`; do not judge this build from the diagnostic wording alone.
- `npm run cli:build` currently stops with `Cannot resolve entry module index.html` because the production config does not point Vite at `site/index.html`. `npm run cli:dev` does use the `site/` workspace and is the working manual-preview entry.
