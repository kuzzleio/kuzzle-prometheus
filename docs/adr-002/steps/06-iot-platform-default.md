# Step 06 — IoT platform: the Kuzzle plugin loaded by default

**Status:** 🟦 In progress
**Dates:** 2026-10-14 → …
**PR(s):** [iot-platform#1092](https://github.com/kuzzleio/iot-platform/pull/1092) (Kuzzle 2.59, prerequisite), [iot-platform#1100](https://github.com/kuzzleio/iot-platform/pull/1100) (draft)
**ADR:** [ADR-0002](../ADR-0002-generic-prometheus-module.md) · issues #11, #12

## Goal

`registerKIoTP()` loads `kuzzle-prometheus/kuzzle` unless `plugins.prometheus.enabled` is `false` (decision 9), and Hypervision inherits it:

- the plugin is always created; the platform's modules and the customer's code reach its `metrics` the same way, enabled or not (register, 2026-10-09);
- no prefix on the instance: `kiotp_*` for the platform, the customer's own prefix for project code;
- the project templates move to Kuzzle 2.59 and `kuzzle-prometheus/kuzzle` (#12);
- the labels the console injects (`kuzzle_plugins__prometheus__labels__{project,environment}`) show up on a customer backend.

## What was done

- 2026-10-14 — Prerequisite: the IoT platform on Kuzzle 2.59 (iot-platform#1092, merged on `4-dev` once its CI was fixed).
- 2026-10-14 — Step opened, ahead of step 05: the work starts now, but iot-platform#1100 stays a draft until the PaaS collects the metrics.
- 2026-10-14 — iot-platform#1100: `kuzzle-prometheus@^1.0.0` in `@kuzzleio/iot-platform-backend`; `registerKIoTP()` creates the plugin and loads it unless it is disabled; `getMetrics(app)` and a `metrics` getter on `Module`; the `Metrics` types re-exported; how-to `doc/4/guides/how-to/expose-metrics/`; unit tests (accessor, opt-out) and a scenario (scrape with a token, anonymous refused).

## Local decisions / gotchas

- **Access by application, not a global:** a `WeakMap<Backend, PrometheusPlugin>` filled by `registerKIoTP()`. `getMetrics(app)` throws before it, so a declaration made too early fails at startup rather than going to an instance nobody exposes.
- **The backend's `kuzzle` peer dependency becomes `>=2.59.0 <3.0.0`:** the plugin requires 2.59. Applications built on the backend (Hypervision) must be on 2.59 before they take this version.
- **Scraper access as on the console:** a user whose role allows only `prometheus:metrics`, authenticated by an API key (#10); the how-to documents it, and `anonymous` keeps no access.
- **No platform metric in the first PR:** `kiotp_*` metrics come with their own modules, once the default is in place.

## Validation

- [x] Unit tests and types of the backend pass locally (iot-platform#1100).
- [ ] iot-platform#1100 CI (functional scenario on a real Kuzzle).
- [ ] Step 05 collects customer backends; #1100 out of draft and merged.
- [ ] Console-injected labels checked on a customer backend.
- [ ] Templates (#12).
