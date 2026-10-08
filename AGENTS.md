# AGENTS.md — working on kuzzle-prometheus

Instructions for agents (and humans) changing this repository. If you are *using* the package in another application, read [docs/agents.md](docs/agents.md) instead.

## What this package is

One npm package, two entry points:

- `kuzzle-prometheus` (`src/index.ts`): framework-agnostic. `createMetrics()`, the typed `counter` / `gauge` / `histogram` wrapper, common labels, Node.js default metrics, `/metrics` rendering. **Must never import `kuzzle`.**
- `kuzzle-prometheus/kuzzle` (`src/kuzzle/`): the Kuzzle plugin, built on the module by composition: it owns a `Metrics` instance (`plugin.metrics`) and declares the Kuzzle metrics on its registry. `kuzzle` is an optional peer dependency: only this entry point may import it. It also re-exports the whole `.` entry point.

The plugin needs two things the public API does not offer: completing the configuration at `init` and reaching the registry (Kuzzle metric names predate the naming rules). They are `completeConfiguration()` and `registryOf()` in `src/metrics.ts`, marked `@internal`: stripped from the `.d.ts` (`stripInternal`) and not exported by the package.

Applications never see `@prometheus-io/client`: its types do not appear in the public API, so that its breaking changes (it is pre-1.0) stop at the wrapper.

Design and history: [ADR-0002](https://github.com/kuzzleio/kuzzle-plugin-prometheus/blob/master/docs/adr-002/ADR-0002-generic-prometheus-module.md) in `kuzzle-plugin-prometheus`.

## Commands

```sh
npm ci
npm test              # lint + types + unit tests: run before every commit
docker compose up -d --wait && npm run test:functional   # against a real Kuzzle
docker compose down -v
npm run test:lint:fix
npm run build         # dist/, CommonJS + .d.ts
npm pack --dry-run    # check what ships
```

Node.js 22 or 24 (`.nvmrc`).

Functional tests run Kuzzle from `src/` (`tests/functional/app/`, through `tsx`) in the `kuzzle-runner` image, which runs `npm ci` **in the mounted repository**: afterwards `node_modules/` holds Linux binaries. On macOS, run the tests inside the container (`docker compose exec -T kuzzle npx vitest run --project functional`) and `npm ci` again once the stack is down.

## Rules

- **TypeScript `strict`**, CommonJS output. No `any` in the public API.
- **The public API is what `src/index.ts` and `src/kuzzle/index.ts` export.** A change to it is a `feat` (addition) or a breaking change (`feat!` / `BREAKING CHANGE:`), and updates the docs in the same commit.
- **Docs ship with the package** (`docs/` is in `files`). A behaviour change updates `docs/` and, when it changes a rule an integrating agent must follow, `docs/agents.md`.
- **Metric names and labels are a contract**: dashboards and alerts depend on them. Renaming one is a breaking change. The label *order* in the text output is not (Prometheus identifies a series by its label set): tests that care about labels use the order-independent `sample()` helper rather than an exact line.
- **Tests**: every public function has unit tests under `tests/unit/`; assert on the rendered Prometheus text, not on library internals.
- **Commits**: Conventional Commits, English. semantic-release derives versions from them: `chore` / `docs` / `test` do not release, `fix` → patch, `feat` → minor.

## Releases

- `master` → npm `latest`; `<N>-dev` → `N.0.0-beta.M` on the `beta` dist-tag.
- Publishing uses npm OIDC trusted publishing from `.github/workflows/release.workflow.yml`: do not rename that file, and never add an npm token.
