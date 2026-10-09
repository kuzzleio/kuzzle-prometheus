# ADR-0002: A generic Prometheus module, and the Kuzzle plugin built on it

**Status:** Accepted
**Date:** 2026-10-06
**Deciders:** Ricky (Kuzzle team)
**Related documents:** [ADR-0001 — maintenance baseline](../adr-001/ADR-0001-maintenance-baseline.md) (prerequisite)

## Decision

### Context

The Kuzzle team runs three kinds of Node.js stacks on its PaaS (Scaleway Kubernetes) and at customers' sites: Kuzzle backends (IoT platform, Hypervision), Node services such as the HTTP/TCP and MQTT ingestion gateways, and Vue.js frontends. Logs already have a shared answer ([`kuzzle-logger`](https://github.com/kuzzleio/kuzzle-logger), pushed to Loki). Metrics do not, so nothing warns us about a degrading application before it becomes critical.

State observed on 2026-10-06:

- **This plugin** binds its collection and exposition logic (`lib/services/MetricService.ts`, `prom-client` registry, default and request metrics) to the Kuzzle plugin API (`lib/PrometheusPlugin.ts`). Nothing in it can be reused by a non-Kuzzle service.
- **No application metric is collected on the PaaS.** In each cluster a Grafana Alloy instance scrapes infrastructure targets (cAdvisor, kube-state-metrics, blackbox probes, Redis) and `remote_write`s them to Scaleway Cockpit, whose ruler evaluates the alert rules. Alloy has no discovery of annotated pods. The `prometheus.io/*` annotations set by the `kuzzle` Helm chart are therefore ignored; their default path (`/_/metrics`) is the plugin's route (corrected in step 03: this line first said `/_/prometheus/metrics`).
- **Adoption**: only the PaaS console's own API loads the plugin (4.2.1). The IoT platform, Hypervision and their project templates do not. The console already injects `kuzzle_plugins__prometheus__labels__{project,environment}` into every customer backend, which has no effect while the plugin is not loaded. Version 5.0.0, released on the same day, has no known user.
- **Other Node services**: the HTTP/TCP gateway exposes its own `prom-client` metrics (`gateway_ingestor_*`) through a Fastify plugin. The MQTT gateway exposes none.
- **`prom-client` 15.1.3 is deprecated on npm** ("replaced by `@prometheus-io/client`"). Its successor (0.16.x) requires Node `^22 || ^24 || >=26`. Every production image already runs Node 22 or 24.

### Options considered

| Question | Options | Chosen |
| --- | --- | --- |
| Plugin ↔ module | inheritance (mixin over Kuzzle's `Plugin`) · composition | **composition**: TypeScript has no multiple inheritance, and the plugin already extends `Plugin` |
| Package layout | npm workspace in this repository · one package with subpath exports, in this repository · one package with subpath exports, in a new repository | **one package with subpath exports, in a new repository**: the `kuzzle-logger` pattern; each repository publishes one package |
| Custom metrics API | expose the underlying registry · thin typed wrapper | **typed wrapper**: applications do not depend on the Prometheus library, and the module enforces conventions |
| Library | stay on `prom-client` · `@prometheus-io/client` | **`@prometheus-io/client`**: no production stack runs Node 20 any more |
| Collection | pull only · pull + push (remote_write / OTLP) | **pull only**: it is the PaaS model (Alloy scrapes, then pushes to Cockpit) |
| Common labels | `tenant` on every metric · `project` / `environment` / `service` | **`project` / `environment` / `service`**: aligned with what the console injects; `tenant` multiplies cardinality |
| Frontends | in scope · out of scope | **out of scope**: a browser cannot be scraped; another tool or ADR |

### Decision

1. **A new package, `kuzzle-prometheus`**, in a new repository `kuzzleio/kuzzle-prometheus` (as `kuzzle-logger`), with two entry points:
   - `kuzzle-prometheus`: framework-agnostic. Registry, Node default metrics, `/metrics` HTTP handler, common labels, naming conventions. No dependency on Kuzzle.
   - `kuzzle-prometheus/kuzzle`: the Kuzzle plugin (hooks, pipes, controller, Kuzzle metrics). Kuzzle is an optional peer dependency.
2. **The plugin owns a module instance** and exposes it to the application, so that an app and its plugins declare their metrics on the same registry as the plugin.
3. **Custom metrics go through a typed wrapper**: `counter`, `gauge` and `histogram`, typed on their labels. The wrapper applies the prefix and the common labels, and rejects label sets beyond a cardinality limit.
4. **Built on `@prometheus-io/client`**, with Node `^22 || ^24` as the supported runtimes.
5. **Common labels `project`, `environment` and `service`**, read from configuration or from the environment the console already injects. Business metrics may add `tenant` themselves.
6. **Pull only**: services expose `/metrics`, and the PaaS scrapes them.
7. **Generic versus specific**: this repository provides the foundation, plus the Kuzzle and Node metrics. Business metrics (IoT devices, rules, ingestion) are declared by their own product with the module's API.
8. **`kuzzle-plugin-prometheus` is deprecated** (2026-10-09; first decided: a 5.x line re-exporting `kuzzle-prometheus/kuzzle`). Applications import `kuzzle-prometheus/kuzzle` directly. Its 5.x versions are unpublished from npm (no user: the console pins 4.2.1), its last version is 4.2.1, and its repository is archived once this repository holds the ADRs, the integration guide and the demo stack. The metric names and configuration keys documented by ADR-0001 do not change.
9. **Default in the IoT platform**: `registerKIoTP()` loads the plugin unless `plugins.prometheus.enabled` is `false`. Hypervision inherits this.

### Consequences

- Kuzzle backends and Node services share one API, one set of labels and one naming convention, so a dashboard or an alert rule can be written once.
- Alerting on application metrics needs PaaS work outside this repository: Alloy must discover annotated pods, and the chart path must be fixed. Until then, the metrics exist but are not collected.
- The new repository needs the ADR-0001 baseline from day one: Node 22/24 CI, semantic-release, npm OIDC trusted publishing, documentation.
- The plugin's code, its tests, the integration guide, the demo stack and the ADRs live in `kuzzle-prometheus`: one repository, one package, one release per fix.
- ADR-0001 and this ADR moved here from `kuzzle-plugin-prometheus` on 2026-10-09. Bare `#N` references in the frozen steps 01–03 and in ADR-0001 point to that repository; references to its code (`lib/`, `index.ts`) describe it before the extraction.
- Node 20 users, and applications on Kuzzle < 2.59, stay on `kuzzle-plugin-prometheus` 4.2.1 (no further fixes).
- `@prometheus-io/client` is pre-1.0: its breaking changes are absorbed by the wrapper, not by applications.

## Cold start

- Steps 01–03 done: the module and the Kuzzle plugin live in `kuzzle-prometheus` (`1.0.0-beta.3` on npm `beta`; npm `latest` is still the empty `0.0.0-bootstrap.0`).
- 2026-10-09: `kuzzle-plugin-prometheus` deprecated, 5.x unpublished (decision 8); its ADRs, integration guide and demo stack moved here.
- Step 04 open: pilot on the HTTP/TCP gateway, migrated in a **draft** PR on its repository (kept as draft until the production versions), on `kuzzle-prometheus@1.0.0-beta.2`; ingestor and worker validated end to end on the beta.
- The PaaS console's API (Kuzzle 2.59, Node 24, plugin 4.2.1) is the first real Kuzzle application to test `kuzzle-prometheus/kuzzle`, on staging; the IoT platform follows once it runs Kuzzle 2.59.
- **Next action:** move the PaaS console's API to `kuzzle-prometheus/kuzzle` (beta) on staging, release `kuzzle-prometheus` 1.0.0 on its feedback, then move the gateway's draft PR to it and close step 04.

## Steps

| # | Step | Status | PR(s) | Detail |
| --- | --- | --- | --- | --- |
| 01 | TypeScript `strict` on the current code | ✅ Done | kuzzle-plugin-prometheus#53 | [detail](steps/01-typescript-strict.md) |
| 02 | Create `kuzzleio/kuzzle-prometheus` with the ADR-0001 baseline (CI, semantic-release, OIDC publishing), modelled on `kuzzle-logger` | ✅ Done | #1 | [detail](steps/02-kuzzle-prometheus-repository.md) |
| 03 | Extract the module into it (`.` + `./kuzzle`), move to `@prometheus-io/client`, typed API, common labels, configurable request buckets; `kuzzle-plugin-prometheus` 5.x re-exports it (since deprecated) | ✅ Done | #2, #3, #4, kuzzle-plugin-prometheus#56 | [detail](steps/03-module-extraction.md) |
| 04 | Pilot: migrate the HTTP/TCP gateway to the module, metric names unchanged | 🟦 In progress | #5 | [detail](steps/04-gateway-pilot.md) |
| 05 | PaaS: pod discovery in Alloy, first Kuzzle alert rules in Cockpit (carried out by the PaaS team, tracked on its side) | ⬜ To do | — | #10 |
| 06 | IoT platform: `kuzzle-prometheus/kuzzle` loaded by default in `registerKIoTP`, opt-out, templates updated | ⬜ To do | — | #11 (templates: #12) |

Order: 01 → 02 → 03. Then 04 and 05 can run in parallel. 06 comes last, so that the default only ships once the metrics are collected.

## Decision register

- 2026-10-06 — Goal recorded: generic module + plugin built on it + default in the IoT platform; design deferred until ADR-0001 is closed.
- 2026-10-06 — ADR-0001 closed (5.0.0 released): design work unblocked.
- 2026-10-06 — One package `kuzzle-prometheus` with `.` and `./kuzzle` exports, in a new repository `kuzzleio/kuzzle-prometheus` (as `kuzzle-logger`); the plugin composes the module.
- 2026-10-06 — `@prometheus-io/client`, Node 22/24; `kuzzle-plugin-prometheus` stays on 5.x as a re-export (no 6.0: 5.x has no user).
- 2026-10-06 — Typed wrapper for custom metrics; common labels `project` / `environment` / `service`; pull only.
- 2026-10-06 — Business metrics live in their products; frontends out of scope.
- 2026-10-06 — Enabled by default in `registerKIoTP`, opt-out with `plugins.prometheus.enabled: false`.
- 2026-10-06 — `kuzzleio/kuzzle-prometheus` created (public, Apache-2.0, default branch `master`).
- 2026-10-06 — Configurable request buckets are redone in the module; the 4.x branch `feat/add-request-duration-bucket-config` (#36) is a reference only.
- 2026-10-08 — `kuzzle-prometheus` publishes through npm OIDC trusted publishing, after a manual placeholder publish (`0.0.0-bootstrap.0`) ([step 02](steps/02-kuzzle-prometheus-repository.md)).
- 2026-10-08 — `kuzzle-prometheus` releases betas from `1-dev`; `master` (1.0.0) after the beta is validated ([step 03](steps/03-module-extraction.md)).
- 2026-10-08 — Documentation first, shipped in the package, with guides for agents: `docs/agents.md` (integrating) and `AGENTS.md` (contributing).
- 2026-10-08 — Common labels from `KUZZLE_PROMETHEUS_{PROJECT,ENVIRONMENT,SERVICE}` (options win), left out when empty.
- 2026-10-08 — Cardinality limit drops new label combinations (warn once, counter), never throws at runtime; declaration errors throw at startup.
- 2026-10-08 — Plugin route is `GET /_/metrics`: the `kuzzle` chart's default path already matches, nothing to fix in step 05.
- 2026-10-08 — Reference documentation lives in `kuzzle-prometheus`; this repository keeps an integration guide for a Kuzzle stack.
- 2026-10-08 — No cluster aggregation in the module until a service needs it.
- 2026-10-08 — Node 20 dropped in 5.1, a minor (supersedes #49's "in a major"): 5.x has no user, and Kuzzle 2.59 on Node 20 stays on 5.0.x.
- 2026-10-08 — `plugin.metrics(request)` becomes `plugin.serveMetrics(request)` (`plugin.metrics` is now the application `Metrics`): kept in 5.1, documented in `docs/upgrading.md`.
- 2026-10-08 — Step 03 closed on the demo stack validation; real-application validation through the gateway pilot (module), the plugin's before the `master` release ([step 03](steps/03-module-extraction.md)).
- 2026-10-09 — Kuzzle core does not embed the module for now: Kuzzle 2.x supports Node 20, `@prometheus-io/client` needs 22+, and enabling metrics is the application's choice.
- 2026-10-09 — `kuzzle-plugin-prometheus` deprecated (supersedes decision 8's 5.x line): 5.x unpublished from npm, `latest` back on 4.2.1, whole package deprecated towards `kuzzle-prometheus/kuzzle`; `5-dev` not released.
- 2026-10-09 — ADRs, ADR tooling, integration guide (`docs/kuzzle-stack.md`) and demo stack (`demo/`) moved to `kuzzle-prometheus`; a migration guide replaces the plugin's upgrade guide; the plugin repository is archived after.
- 2026-10-09 — The real-application test of the Kuzzle plugin moves to the IoT platform (step 06 imports `kuzzle-prometheus/kuzzle`).
- 2026-10-09 — The PaaS console's API tests the Kuzzle plugin first (supersedes the line above for the 1.0.0 gate): it already runs Kuzzle 2.59 on Node 24, the IoT platform does not yet.
- 2026-10-09 — Step 05 is carried out by the PaaS team (Alloy scrape, metric filter, scraping role, alert rules); this ADR keeps the row and #10.
- 2026-10-09 — Step 06: the IoT platform always creates the plugin and gives its modules and the customer's code stable access to `metrics`, even when `plugins.prometheus.enabled` is `false` (declarations then work, nothing is exposed).
- 2026-10-09 — Step 06: no prefix on the IoT platform's instance; metrics carry full names, `kiotp_*` for the platform, the customer's own prefix for project code. No `scope()` API unless the convention falls short.
- 2026-10-09 — A library never calls `createMetrics()`: it receives the host's `Metrics` (a service's `createMetrics()`, a Kuzzle application's `plugin.metrics`). To document when the first shared library needs it.
- 2026-10-09 — Who sets `service` and `environment` (the module or the scraper's relabelling, which uses the same names) and the cost of `nodeId` (a new series set per restart) are settled at collection (step 05), not in the module.

## Open points

The release sequence is tracked in #8.

- Test `kuzzle-prometheus/kuzzle` (beta) in a real Kuzzle application (the PaaS console's API, on staging) before releasing 1.0.0.
- At 1.0.0, remove the `bootstrap` dist-tag of `kuzzle-prometheus` and check that `latest` is 1.0.0.
- `kuzzle-plugin-prometheus` wound down on 2026-10-09 (`master` back on 4.2.1 with a deprecation README, `5-dev` and the v5 tags and releases deleted, open issues transferred here as #10–#13, repository archived). The docs.kuzzle.io tile points here (kuzzleio/documentation#604). Left: revoke the npm token it used (no repository secret left).

## References

- [`@prometheus-io/client`](https://www.npmjs.com/package/@prometheus-io/client) · [`prom-client`](https://github.com/siimon/prom-client)
- [`kuzzle-logger`](https://github.com/kuzzleio/kuzzle-logger): the subpath-exports precedent
