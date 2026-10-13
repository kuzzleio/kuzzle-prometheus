# Step 04 — Pilot: the HTTP/TCP gateway on the module

**Status:** 🟦 In progress
**Dates:** 2026-10-08 → …
**PR(s):** [kuzzle-prometheus#5](https://github.com/kuzzleio/kuzzle-prometheus/pull/5), the gateway's migration PR (private repository)
**ADR:** [ADR-0002](../ADR-0002-generic-prometheus-module.md)

## Goal

The HTTP/TCP ingestion gateway, a Node service outside Kuzzle, exposes its metrics through `kuzzle-prometheus` instead of its own `prom-client` setup:

- one `createMetrics()` instance, served on the gateway's existing `/metrics` route (Fastify);
- its `gateway_ingestor_*` metrics declared through the typed API, **names unchanged**, so that existing dashboards keep working;
- common labels `project` / `environment` / `service` from the `KUZZLE_PROMETHEUS_*` variables;
- first use of the module in a real service: it validates `kuzzle-prometheus@1.0.0-beta` before 1.0.0.

## What was done

- 2026-10-08 — Step opened.
- 2026-10-08 — Inventory: 18 metrics (ingestor, worker, one shared gauge), all compliant with the naming rules; labels `protocol`, `reason`, `result`, all bounded; `inc` / `dec` / `set` / `startTimer` used as the module offers them; histograms on the default buckets, which the module keeps. One gap: two gauges set at scrape time through `prom-client`'s `collect`.
- 2026-10-08 — Module: gauge `collect` callback (kuzzle-prometheus#5, `1.0.0-beta.2`), sync or async, a failure logged without failing the scrape.
- 2026-10-08 — Gateway migrated: its Fastify plugin creates the instance (`prefix: "gateway_"`, `service` per app) and serves `render()`; metrics declared on it with unchanged names; `prom-client` removed. Draft PR opened on the gateway's repository, on `kuzzle-prometheus@1.0.0-beta.2`: it stays a draft until the production versions (1.0.0, then without the `minimumReleaseAgeExclude` entry).

- 2026-10-08 — Review pass on both repositories before the real-application test: a gauge `collect` that never settles is given up after 5 s (kuzzle-prometheus#7, `1.0.0-beta.3`); the plugin moves to it (it was on beta.1, without the gauge `collect`); `docs/upgrading.md` documents the plugin API change and pins Node 20 users to `~5.0`.
- 2026-10-09 — `kuzzle-plugin-prometheus` deprecated, 5.x unpublished (hub, decision 8): the plugin's real-application test before 1.0.0 now runs in the IoT platform on `kuzzle-prometheus/kuzzle`.
- 2026-10-09 — The PaaS console's API takes that test first (Kuzzle 2.59 on Node 24 already), on staging; the IoT platform must move to Kuzzle 2.59 first.
- 2026-10-09 — PaaS console's API on `1.0.0-beta.3`, local then staging (Kuzzle 2.59.0, Node 24, 7 plugins, 2 pods), validation report received 2026-10-12: **no blocker for 1.0.0**. Migration is the package and the import only; the 37 families of 4.2.1 unchanged (names, types, labels, buckets), plus the 3 the migration guide announces; only the label order of the text output changes. A dedicated user whose role allows `prometheus:metrics` only scrapes `/_/metrics` (200; other actions 403; 401 once the key is deleted). After ~3 h: no restart, no plugin warning, scrapes of 20–41 ms. Feedback: the platform's relabelling overwrites `environment` / `service` without warning, and Alloy (Prometheus 3) normalises `le` to `15.0` before relabelling: both documented; an option to leave `nodeId` out (the console drops it at collection, `pod` identifies the node).
- 2026-10-12 — Feedback shipped: docs (#15) and `core.nodeIdLabel` (#16), released as `1.0.0-beta.4`.
- 2026-10-12 — PaaS console's API on `1.0.0-beta.4`, local: the lockfile changes `kuzzle-prometheus` only; types, lint and tests green, Kuzzle 2.59.0 starts with its 7 plugins. By default `/_/metrics` is the beta.3 output (40 families, same types, label sets and buckets, `nodeId` on every series). With `core.nodeIdLabel: false` in `.kuzzlerc`, no series carries `nodeId` (430 before) in any family (Kuzzle, Node.js, process, GC), the rest unchanged; Prometheus still scrapes the target (`up` 1) and stores no `nodeId` series, a control query on the pre-restart series ruling out a false negative. Gotcha: `nodejs_gc_duration_seconds_*` has no series on a fresh process until the first GC, not an effect of the option. Staging pending: option set by `kuzzle_plugins__prometheus__core__nodeIdLabel=false`, Alloy's `nodeId` labeldrop removed in the same change; checks: `up` 1 on both pods, no `nodeId` series, same series count per pod at equal traffic, no new series after a pod restart.
- 2026-10-12 — PaaS console's API on `1.0.0-beta.4`, staging (2 pods), option set by `kuzzle_plugins__prometheus__core__nodeIdLabel=false` (converted to a boolean), Alloy's `nodeId` labeldrop removed: **`core.nodeIdLabel` validated**, no discrepancy. `up` 1 on both pods; no `nodeId` series, neither in the pods' `/_/metrics` nor in storage; same series count per pod at equal traffic (29 fixed + 8 per controller × action served); restarting a pod's Kuzzle container creates no new series (same label sets before and after).
- 2026-10-12 — Dependabot alerts before 1.0.0: none on GitHub, which scans `master` only (still the bootstrap). `npm audit` on `1-dev`: 13 (1 critical, 6 high), all in the tree of the `kuzzle` devDependency (2.59.0, the latest: protobufjs, lodash, ws, tmp, re2…); the runtime tree (`npm audit --omit=dev --omit=peer`) has none. Not shipped: an application gets that tree through its own `kuzzle`. No blocker; once `1-dev` is on `master`, GitHub will raise them as development alerts.
- 2026-10-12 — `kuzzle-prometheus@1.0.0` released on npm `latest` (#19, provenance signed); `master` fast-forwarded back into `1-dev`; `bootstrap` dist-tag removed (dist-tags: `latest` 1.0.0, `beta` 1.0.0-beta.4). GitHub now shows 18 Dependabot alerts, all of development scope, as expected.
- 2026-10-12 — PaaS console's API in production on `kuzzle-prometheus@1.0.0` (console v3.36.0), `core.nodeIdLabel: false`: `up` 1 on both pods over 4 consecutive scrape rounds, 80 series per pod, no `nodeId`, 6 histogram buckets. Labels: the console sets `service`, `environment` and `project` itself through `kuzzle_plugins__prometheus__labels__*`, and Alloy no longer relabels this scrape; the values equal those the platform sets on the pod's container series, so joins hold. Checked: nothing overwritten, no `exported_*` label. Customer backends still open: the platform would put its own values under other names (`cluster`, `namespace`), to validate with the project template on the PaaS side.
- 2026-10-12 — PaaS console's API, staging and production: **`core.requestDurationBuckets` validated** from a Helm variable (`*json:[5,50,100,200,500,1000,2500,10000]`): Kuzzle's `loadConfig()` yields an array, which replaces the default rather than being merged; Alloy's bucket `drop` rule removed, 9 buckets including `+Inf`, 57 series per pod. A dashboard built on the module's metrics (29 panels: traffic, durations, per-action profile, blackbox probe against p95, runtime) runs on both environments. Application alerts wait for 7 days of traffic on the new buckets (not before 2026-10-19). Feedback: stored `le` is a float (`500.0`) in queries too, documented in `kuzzle-metrics.md`; label convention for customer backends agreed (platform values under other names).
- 2026-10-13 — Gateway PR moved to `kuzzle-prometheus@1.0.0` and out of draft (types, lint, format, 27 tests green), then merged on `main` (kuzzleio/gateway#21). The `minimumReleaseAgeExclude` entry stays until 2026-10-19 (1.0.0 is younger than pnpm's 7 days).

## Local decisions / gotchas

- **Names unchanged versus naming rules**: the module enforces snake_case, `_total` on counters and no common label in `labelNames` at declaration. Inventory the gateway's metrics first; a name the rules reject needs a decision (rename, which breaks dashboards, or a change in the module) before migrating. Outcome: every name complies.
- **`prefix: "gateway_"`** rather than full names: the shared `gateway_rabbitmq_connected` rules out a per-app prefix.
- **pnpm `minimumReleaseAge`** (7 days) in the gateway refuses a fresh beta: `kuzzle-prometheus` is listed in `minimumReleaseAgeExclude`.
- **The module is CommonJS, the gateway ESM** (`"type": "module"`, TypeScript `nodenext`): named imports work, nothing to change.

## Validation

- PaaS console's API: see the 2026-10-09 entry above (staging, 2 pods); `core.nodeIdLabel` on `1.0.0-beta.4`: the 2026-10-12 entries.

- Gateway: types, lint, format, 27 tests.
- Ingestor run against RabbitMQ with HTTP and TCP traffic, `/metrics` compared with `main`: same names, labels, buckets and values; added: `service="ingestor"`, the event loop utilization metrics, and the Prometheus `Content-Type`. Rerun on the published `1.0.0-beta.2`: same result, `collect` gauges set.
- Worker run in Docker (the gateway's `Dockerfile.dev`) against RabbitMQ and this repository's demo Kuzzle 2.59: every worker metric recorded with `service="worker"` (consumed, parse duration, invalid, dead-lettered, Kuzzle query duration and outcome, requeued, backoff, RabbitMQ connection). Outside Docker, `tsx` on Node 24.11 fails on a `kuzzle-sdk` named import, on the gateway's `main` too: unrelated to the migration.
