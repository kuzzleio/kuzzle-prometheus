# Kuzzle plugin

`kuzzle-prometheus/kuzzle` exposes the metrics of a Kuzzle backend: Kuzzle's own metrics, the duration of every API request, the Node.js process metrics, and the application's custom metrics. Kuzzle `>=2.59.0 <3`, Node.js 22.12+ or 24.

## Set up

```sh
npm install kuzzle-prometheus
```

```ts
import { Backend } from "kuzzle";
import { PrometheusPlugin } from "kuzzle-prometheus/kuzzle";

const app = new Backend("my-app");

const prometheus = new PrometheusPlugin();
app.plugin.use(prometheus);

app.start();
```

Register the plugin on **every** node: each node exposes its own metrics, and Prometheus scrapes each node.

## Scrape

| Route | Use it when |
| --- | --- |
| `GET /_metrics?format=prometheus` | the scraper can send query parameters (a Prometheus `scrape_config` with `params`) |
| `GET /_/metrics` | it cannot, such as Kubernetes `prometheus.io/path` annotations |

Both answer with the Prometheus text format, over HTTP only. `/_metrics` without `format=prometheus` keeps Kuzzle's JSON answer.

Access rights: the scraper needs `server:metrics` (first route) or `prometheus:metrics` (second route). For an anonymous scrape, give that right to the `anonymous` role.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: kuzzle
    metrics_path: /_metrics
    params:
      format: [prometheus]
    static_configs:
      - targets: ["kuzzle:7512"]
```

## Application metrics

The plugin owns the application's `Metrics` instance: `prometheus.metrics`. Declare the application's metrics on it, at startup, and they are exposed with the Kuzzle metrics.

```ts
const prometheus = new PrometheusPlugin({ prefix: "iot_" });

export const payloads = prometheus.metrics.counter({
  name: "payloads_received_total",
  help: "Payloads received from devices",
  labelNames: ["protocol"],
});

// later, in a controller or a pipe
payloads.inc({ protocol: "mqtt" });
```

Never call `createMetrics()` in a Kuzzle application: its metrics would not be exposed. [Custom metrics](custom-metrics.md) covers types, labels and naming.

Constructor options:

| Option | Default | Description |
| --- | --- | --- |
| `prefix` | `""` | prepended to the application's metric names (not to Kuzzle's) |
| `maxLabelSets` | `1000` | label combinations accepted per application metric (see [Custom metrics](custom-metrics.md#keep-labels-bounded)) |

Warnings, such as a metric reaching `maxLabelSets`, go to Kuzzle's logger.

## Configuration

The `plugins.prometheus` section of Kuzzle's configuration, read once at startup. It is deep-merged over the defaults; an array replaces the default array.

```json
{
  "plugins": {
    "prometheus": {
      "core": {
        "monitorRequestDuration": true,
        "prefix": "kuzzle_",
        "requestDurationBuckets": [0.1, 5, 15, 50, 100, 200, 300, 400, 500]
      },
      "default": {
        "enabled": true,
        "prefix": "",
        "eventLoopMonitoringPrecision": 10,
        "gcDurationBuckets": [0.001, 0.01, 0.1, 1, 2, 5]
      },
      "labels": {
        "project": "acme",
        "environment": "production"
      }
    }
  }
}
```

| Key | Default | Effect |
| --- | --- | --- |
| `core.prefix` | `"kuzzle_"` | prefix of the Kuzzle metrics and of the request duration histogram; the shipped dashboards expect `kuzzle_` |
| `core.monitorRequestDuration` | `true` | records every API request in `<prefix>api_request_duration_ms` |
| `core.requestDurationBuckets` | `[0.1, 5, 15, 50, 100, 200, 300, 400, 500]` | buckets of that histogram, in milliseconds, ascending |
| `default.enabled` | `true` | Node.js process metrics |
| `default.prefix` | `""` | prefix of the Node.js metrics; empty so that standard dashboards work |
| `default.eventLoopMonitoringPrecision` | `10` | event loop lag sampling, in milliseconds |
| `default.gcDurationBuckets` | `[0.001, 0.01, 0.1, 1, 2, 5]` | GC duration buckets, in seconds |
| `labels` | `{}` | labels added to every metric of the node |

As with any Kuzzle setting, environment variables override the file, with `__` as separator and `*json:` for arrays:

```sh
kuzzle_plugins__prometheus__labels__project=acme
kuzzle_plugins__prometheus__core__requestDurationBuckets='*json:[5,50,500,5000]'
```

If you register the plugin under another name (`app.plugin.use(plugin, { name: "metrics" })`), its section is named after it.

### Labels

Every metric of the node carries:

- `nodeId`: the Kuzzle node ID, new at each restart;
- the common labels `project`, `environment`, `service` (see [Configuration](configuration.md#common-labels)), from `labels` or from the `KUZZLE_PROMETHEUS_*` environment variables, `labels` winning;
- every other pair of `labels`.

Keep `labels` values fixed for the life of the process, and do not use `nodeId`, `protocol`, `controller`, `action` or `status` as label names: the plugin uses them.

## Going further

- [Kuzzle metrics reference](kuzzle-metrics.md): every metric the plugin exposes, and PromQL examples.
- [Troubleshooting](troubleshooting.md).
- [Integration guide](https://github.com/kuzzleio/kuzzle-plugin-prometheus/blob/5-dev/docs/kuzzle-stack.md) (`kuzzle-plugin-prometheus`): a dedicated scraper user, Prometheus jobs for clusters, Kubernetes, Grafana dashboards.
