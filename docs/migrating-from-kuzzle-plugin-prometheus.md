# Migrating from kuzzle-plugin-prometheus

`kuzzle-plugin-prometheus` is deprecated: its Kuzzle plugin is now the `kuzzle-prometheus/kuzzle` entry point of this package. Its last version is 4.2.1. Metric names, routes and configuration keys do not change; the runtime requirements do.

## What changes

| | `kuzzle-plugin-prometheus` 4.x | `kuzzle-prometheus/kuzzle` |
| --- | --- | --- |
| Package | `kuzzle-plugin-prometheus` | `kuzzle-prometheus`, entry point `kuzzle-prometheus/kuzzle` |
| Node.js | not declared | `^22.12.0` or `^24.0.0` |
| Kuzzle | `>=2.16.9 <3`, checked at load only | `>=2.59.0 <3.0.0`, checked at load and declared as an optional **peer dependency** |
| Prometheus client | `prom-client` 15.1.0 | `@prometheus-io/client` 0.16 (its successor), never exposed to the application |
| Request duration buckets | fixed | `core.requestDurationBuckets` (same default) |
| Application metrics | not supported | `plugin.metrics.counter()` / `gauge()` / `histogram()`, see [Kuzzle plugin → Application metrics](kuzzle.md#application-metrics) |
| Common labels | `labels`, any name | same, plus the reserved names `project` / `environment` / `service` and the `KUZZLE_PROMETHEUS_*` variables, see [Configuration](configuration.md#common-labels) |

New series, which do not affect existing dashboards: `nodejs_eventloop_utilization_summary` and `nodejs_eventloop_utilization_histogram`, and `kuzzle_prometheus_label_sets_rejected_total` once an application metric drops label combinations.

The order of the labels in the text output of the histograms changed (`nodeId` and your labels before `action`, `controller`…). Prometheus identifies a series by its label set: queries, dashboards and alerts are not affected; only a tool comparing raw text lines would be.

## What does not change

- Metric names, types, labels and the default request duration buckets: dashboards and alerts keep working.
- The configuration section `plugins.prometheus`, its keys and their defaults.
- The routes `/_metrics?format=prometheus` and `/_/metrics`, and the rights they need.

## Fixed

- `core.monitorRequestDuration: false` no longer makes Kuzzle log `Error executing hook on "request:onSuccess"` on every request.
- `default.gcDurationBuckets` replaces the default buckets. In 4.x, it was merged index by index with them: `[0.5, 3]` gave `[0.5, 3, 0.1, 1, 2, 5]`. If you set it, check the buckets you get.

## Plugin API

Only code that uses the `PrometheusPlugin` instance itself is affected; registering it with `app.plugin.use()` and configuring it do not change.

| | 4.x | `kuzzle-prometheus/kuzzle` |
| --- | --- | --- |
| `plugin.metrics` | method `metrics(request)`: the handler of `GET /_/metrics` | the `Metrics` instance for application metrics; the handler is renamed `serveMetrics(request)` |
| `plugin.config.labels` | `JSONObject` | `Record<string, string>`: values are converted to strings |

Replace calls to `plugin.metrics(request)` with `plugin.serveMetrics(request)`.

## Steps

1. **Node.js**: run Kuzzle on Node.js 22.12+ or 24. With Docker, the `kuzzleio/kuzzle-runner:<major>-trixie-slim` images fit; the bookworm-based ones lack the glibc that Kuzzle 2.59's uWebSockets.js needs.
2. **Kuzzle**: upgrade the application to Kuzzle 2.59.0 or a later 2.x. The application provides `kuzzle`; npm 7 and later refuse to install next to a Kuzzle outside the peer range (`ERESOLVE`).
3. **Package**:

   ```sh
   npm uninstall kuzzle-plugin-prometheus
   npm install kuzzle-prometheus
   ```

   ```diff
   - import { PrometheusPlugin } from "kuzzle-plugin-prometheus";
   + import { PrometheusPlugin } from "kuzzle-prometheus/kuzzle";
   ```

   The code registering the plugin and its configuration stay the same.
4. **Check**: `curl "http://<node>:7512/_metrics?format=prometheus"` on each node returns the same metric names as before.

An application that cannot leave Node.js 20 or Kuzzle < 2.59 yet stays on `kuzzle-plugin-prometheus@4.2.1`, which receives no further fixes.
