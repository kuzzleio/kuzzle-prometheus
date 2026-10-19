# Step 06 — IoT platform: the Kuzzle plugin loaded by default

**Status:** 🟦 In progress
**Dates:** 2026-10-14 → …
**PR(s):** [iot-platform#1092](https://github.com/kuzzleio/iot-platform/pull/1092) (Kuzzle 2.59, prerequisite), [iot-platform#1100](https://github.com/kuzzleio/iot-platform/pull/1100), [template-kuzzle-project#10](https://github.com/kuzzleio/template-kuzzle-project/pull/10) (pilot), [iot-platform#1109](https://github.com/kuzzleio/iot-platform/pull/1109) (frontend fix), [template-kiotp-project#39](https://github.com/kuzzleio/template-kiotp-project/pull/39), #35, PaaS console's Alloy PR #803
**ADR:** [ADR-0002](../ADR-0002-generic-prometheus-module.md) · issues #11, #12

## Goal

`registerKIoTP()` loads `kuzzle-prometheus/kuzzle` unless `plugins.prometheus.enabled` is `false` (decision 9), and Hypervision inherits it:

- the plugin is always created; the platform's modules and the customer's code reach its `metrics` the same way, enabled or not (register, 2026-10-09);
- no prefix on the instance: `kiotp_*` for the platform, the customer's own prefix for project code;
- the project templates move to Kuzzle 2.59 and `kuzzle-prometheus/kuzzle` (#12), and the IoT platform template (`template-kiotp-project`, still v3) gets the metrics in its v4 migration;
- the labels the console injects (`kuzzle_plugins__prometheus__labels__{project,environment}`) show up on a customer backend.

## What was done

- 2026-10-14 — Prerequisite: the IoT platform on Kuzzle 2.59 (iot-platform#1092, merged on `4-dev` once its CI was fixed).
- 2026-10-14 — Step opened, ahead of step 05: the work starts now, but iot-platform#1100 stays a draft until the PaaS collects the metrics.
- 2026-10-14 — iot-platform#1100: `kuzzle-prometheus@^1.0.0` in `@kuzzleio/iot-platform-backend`; `registerKIoTP()` creates the plugin and loads it unless it is disabled; `getMetrics(app)` and a `metrics` getter on `Module`; the `Metrics` types re-exported; how-to `doc/4/guides/how-to/expose-metrics/`; unit tests (accessor, opt-out) and a scenario (scrape with a token, anonymous refused).

- 2026-10-14 — Naming settled before #1100 leaves draft (below): guard test on the prefixes in #1100's scrape scenario, JSDoc and how-to on `app_`; kuzzle-prometheus#28 documents hosts whose instance has no prefix.
- 2026-10-14 — #12 done: `template-kuzzle-project` on Kuzzle 2.59 and `kuzzle-prometheus/kuzzle` (template-kuzzle-project#9).
- 2026-10-14 — iot-platform#1100: `loadPrometheusPlugin()` loads the plugin and imports the `prometheus-scraper` role and profile unless it is disabled; unit tests (imported, not when disabled), scenario (scrape with a `prometheus-scraper` user's API key, 403 on any other action), how-to (`kourou` commands for the user and its key). CI green. Proposal posted on #10; the PaaS accepts the names ([answer](https://github.com/kuzzleio/kuzzle-prometheus/issues/10#issuecomment-6178379257)).
- 2026-10-14 — Pilot: every project template, `template-kuzzle-project` first. template-kuzzle-project#10: `MetricsModule` imports the same `prometheus-scraper` role and profile; README section; unit and functional tests.
- 2026-10-14 — `docs/kuzzle-stack.md` and `doc/1/`: one key per backend, one `PodMonitor` and its `Secret` per backend namespace.
- 2026-10-15 — kuzzle-prometheus#29 and template-kuzzle-project#10 merged. The template releases on the console's dispatch, not on merge: the pilot is a new KuzzleES8 app (chart `paas-kuzzle-es8` 1.6.0, `PodMonitor` off until the console writes the `Secret` `kuzzle-metrics-scraper`, Alloy reads only PodMonitors labelled `paas.kuzzle.io/metrics=kuzzle`).
- 2026-10-15 — `service` label: the console sets `service=kuzzle` on every Kuzzle backend (its ADR-0007); `docs/kuzzle.md`, `docs/agents.md` and `doc/1/` say who sets which common label in a Kuzzle backend, and the precedence.
- 2026-10-15 — The console cannot create the scraper's user (no admin access): the backend imports it (decision below). template-kuzzle-project#11 and iot-platform#1100 (b6bf61e) import the user when `KUZZLE_PROMETHEUS_SCRAPER_PASSWORD` is set, with `auth:createApiKey` / `auth:deleteApiKey` in the role; functional tests replay the console's flow. Checked on Kuzzle 2.59: a restart replays nothing (import hash unchanged); with another password the import logs `Users skipped`, the old password still logs in. One `Secret` per application (`<shortId>-metrics-scraper`): the console deploys a project's apps in one namespace. `docs/kuzzle-stack.md` and `doc/1/`: the no-admin-collector setup.
- 2026-10-15 — Pilot `testtemplate` (template-kuzzle-project, console v3.38.0) collected by the PaaS; iot-platform#1100 out of draft.
- 2026-10-16 — iot-platform#1100 merged on `4-dev` (404431c) and released in `4.0.0-4-dev.211` (`release-next.yml`, dispatched by hand: `4-dev` prereleases do not come from the push workflow).
- 2026-10-16 — `template-kiotp-project` on the platform v4 (#39, merged on a new `dev` branch: `stable` stays v3 until 4.0.0): `TenantClass` and device-manager 3 renames, `DevicesModule` declares `app_sample_device_payloads_total`, a functional test replays the console's scraper flow, README section (access, `app_`, opt-out). Web console minimal (Vue 3, Tailwind 4, Vite 8), Keycloak left to the console, as in `template-hypervision-project`.
- 2026-10-16 — The frontend 211/212 did not load outside the monorepo (`require("leaflet")` in `dist/lib.js` since Vite 8): iot-platform#1109, released in `4.0.0-4-dev.213`, which the template uses.
- 2026-10-16 — A label-less metric assigned to a field typed `Counter<never>` did not compile (label names inferred from the assignment target): `NoInfer` on the return types (#35, `1.0.1-beta.1`).
- 2026-10-19 — Pilot from `template-kiotp-project`: a project created by the console (`v1.0.0-dev.1` from `dev`, environment `main`) collected in production, `app_sample_device_payloads_total` included. Alloy's keep-list (the PaaS's D4 filter) now keeps `kiotp_*` and `hyp_*` on every backend and `app_*` per namespace, this pilot only (PaaS console's ADR-0007, step 04). The 4.0.0-4-dev.213 platform declares no `kiotp_*` metric yet.

## Local decisions / gotchas

- **Access by application, not a global:** a `WeakMap<Backend, PrometheusPlugin>` filled by `registerKIoTP()`. `getMetrics(app)` throws before it, so a declaration made too early fails at startup rather than going to an instance nobody exposes.
- **The backend's `kuzzle` peer dependency becomes `>=2.59.0 <3.0.0`:** the plugin requires 2.59. Applications built on the backend (Hypervision) must be on 2.59 before they take this version.
- **Scraper access as on the console:** a user whose role allows only `prometheus:metrics`, authenticated by an API key (#10); `anonymous` keeps no access.
- **The platform declares the scraper's role and profile** (`prometheus-scraper`, only `prometheus:metrics`) through `app.import`, like its other roles, only when the plugin is loaded. The PaaS creates the user and its API key: a secret of each environment, held by Alloy. Why: the platform loads the plugin, so it brings the access to it; every customer backend and Hypervision inherits it, and no template carries it. Rejected: the templates (one copy per template, drifting), the PaaS provisioning the role too (two sources of truth), the plugin itself (it has no `app.import`, and creating security objects at runtime is invasive). `template-kuzzle-project`, which does not use the platform, would carry the same few lines if a backend from it is collected; a `scraperRole` export from `kuzzle-prometheus/kuzzle` only if a second such consumer appears.
- **PaaS answer (2026-10-14, #10):** `prometheus-scraper` is fine for the role, profile and user of customer backends. The console's own Kuzzle keeps its `metrics-scraper` (role, profile, user created at boot): a separate Kuzzle, no collision, and renaming it would rotate a key for nothing. Do not align one on the other.
- **One API key per backend:** each Kuzzle signs its API keys with its own secret, so every backend has its own token, while an Alloy `prometheus.scrape` has one `authorization` block for all its targets. Pod discovery with a single bearer cannot collect customer backends: one scrape component per backend (generated by the console or Terraform) or another setup, a PaaS design item for step 05. The scraper's user can only be created once the backend runs a version that imports the role: provisioning runs after that deploy, not at project creation.
- **Collection by PodMonitor + Secret per namespace** (lead accepted by the PaaS for step 05, #10): one Alloy with `prometheus.operator.podmonitors`; each backend namespace holds a `PodMonitor` (from the chart) and the `Secret` with its key (from the console, after the deploy). Resources in the customer's namespace rather than edits to a central configuration. Checked by the PaaS: Alloy's ClusterRole already reads secrets and podmonitors; customers have no Kubernetes access; the Prometheus Operator CRDs are not installed yet (CRDs only, before any chart ships a PodMonitor); a new backend must not show up as down before its Secret exists.
- **The backend imports the scraper's user** (2026-10-15, revises "the PaaS creates the user" above): the console renders Helm values and writes Secrets, but holds no admin account on the backends. When `KUZZLE_PROMETHEUS_SCRAPER_PASSWORD` is set, the backend imports `prometheus-scraper` (local strategy); the role adds `auth:createApiKey` and `auth:deleteApiKey`, limited by Kuzzle to the user's own keys. After a deploy the console checks its key (`auth:checkToken`), otherwise logs in, deletes and recreates the key `paas-metrics-scraper`, writes the Secret and turns the `PodMonitor` on. Never `onExistingUsers: "overwrite"` (recreating the user deletes its keys); the password is fixed at first start. Rejected: a static token in the plugin's configuration (bypasses the dedicated Kuzzle identity, changes the plugin). Accepted risk: a leaked key can mint more keys, all limited to the metrics.
- **Rejected (2026-10-14):** a dedicated unauthenticated metrics port closed by NetworkPolicy (a feature in the plugin, a port in the chart, security resting on NetworkPolicies: more spread, not less), and `anonymous` with `prometheus:metrics` (the API port is public, and `POST /_query` bypasses any path filter in the Ingress). One Alloy per organisation does not remove the N keys per Alloy; a datasource per organisation is a read-side topic, separate.
- **One prefix per producer** (refines the 2026-10-09 register line):

  | Producer | Prefix | Guard |
  | --- | --- | --- |
  | IoT platform | `kiotp_` | guard test in iot-platform (#1100) |
  | Hypervision (a product built on the platform) | `hyp_` | its own guard test, when it declares its first metrics |
  | Project code, on the platform or on Hypervision | `app_`, fixed and shared by every project | convention and templates |
  | PaaS console | `console_`, if it ever declares some | — |

  Reserved: `kuzzle_` (the plugin, and the module's `kuzzle_prometheus_label_sets_rejected_total`), `nodejs_` and `process_` (Node.js metrics). Project code never uses `kiotp_`, `hyp_` or `kuzzle_`; the `project` label tells projects apart. Why: a new platform version cannot collide with project code, each product's dashboards and alerts serve all its customers, collection can filter by prefix, and the prefix names who gets the alert.
- **The guard test reads the `# TYPE` lines:** they list every declared metric, even one without a sample, and skip the histogram suffixes. It sees only the modules the demo loads (Keycloak is off in CI), and platform code using `app_` by mistake is left to review.
- **Rejected:** a prefixed wrapper in the platform (it needs `Module` split between platform and project code, for the protection the guard already gives), an ESLint rule on `name:` literals (fragile), an instance prefix (project metrics would become `kiotp_*`), `scope(prefix)` or reserved prefixes in `kuzzle-prometheus`.
- **Reopen `scope(prefix)`** when Hypervision declares its first `hyp_*` next to the `kiotp_*`, when a shared library (device-manager, workflows…) wants its own metrics on the host's instance, or when review lets an unprefixed name through. It would be a `feat` (minor) with its tests and docs (`docs/`, `doc/1/`, `docs/agents.md`), and a register line reversing the 2026-10-09 one.
- **For step 05 (PaaS):** a keep-list per scrape job rather than a global one. Kuzzle backends: `kuzzle_.*|kiotp_.*|hyp_.*|nodejs_.*|process_.*`. Node services: their instance prefix (`gateway_.*`) plus `nodejs_.*|process_.*`. `app_.*` is enabled per project.
- **Platform v4 at startup** (found with `template-kiotp-project`, not specific to the metrics): the backend crashes without a `plugins.keycloak` key (`registerKIoTP` reads `.enabled`), so the templates keep `"keycloak": { "enabled": false }` and the console's `kuzzle_plugins__keycloak__*` override it; and it refuses to start without `application.crypto.keys`: a public key in `compose.yml` for local development, a key per environment injected at runtime on the PaaS (`kuzzle_application__crypto__keys`), to be provided by the console.
- **A v4 project from the console** (pilot, 2026-10-19): the console creates the repository from the template's default branch only (`stable`, still v3), so the `dev` branch is pushed into the project by hand until 4.0.0 makes `stable` v4. The GitHub credentials (`PAAS_ROBOT_APIKEY`, registry robot) are a manual step in the console ("Configurer l'environnement GitHub", "Générer les identifiants"); without them CI fails with `E401` on the private registry. The console environment's name must match a folder under `apps/api/lib/environments/` (here `main`, added to the project).
- **No platform metric in the first PR:** `kiotp_*` metrics come with their own modules, once the default is in place.

## Validation

- [x] Unit tests and types of the backend pass locally (iot-platform#1100).
- [x] iot-platform#1100 CI (functional scenario on a real Kuzzle), scraper role included.
- [x] Step 05 collects customer backends; #1100 out of draft and merged (2026-10-16, `4.0.0-4-dev.211`).
- [x] Console-injected labels checked on a customer backend (pilot, 2026-10-15).
- [x] `template-kuzzle-project` on Kuzzle 2.59 and the plugin (#12).
- [x] Pilot: template-kuzzle-project#10 merged; a backend from it collected by the PaaS.
- [x] `template-kiotp-project` on the platform v4 (#39, `4.0.0-4-dev.213`): the `app_` convention, an example in a module, the opt-out documented.
- [x] A backend from `template-kiotp-project` collected by the PaaS, `app_*` included (2026-10-19).
- [ ] `template-hypervision-project`, once on a Hypervision version that contains #1100.
