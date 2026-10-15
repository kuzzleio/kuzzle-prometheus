---
code: false
type: page
order: 200
title: Kuzzle plugin
description: Expose the metrics of a Kuzzle application with the PrometheusPlugin
---

# Kuzzle Plugin

`kuzzle-prometheus/kuzzle` exposes the metrics of a Kuzzle application: Kuzzle's own metrics, the duration of every API request, the Node.js process metrics, and the application's custom metrics.

Requirements: Kuzzle `>=2.59.0 <3`, Node.js 22.12+ or 24.

## Set up

```bash
npm install kuzzle-prometheus
```

```typescript
import { Backend } from 'kuzzle';
import { PrometheusPlugin } from 'kuzzle-prometheus/kuzzle';

const app = new Backend('my-app');

const prometheus = new PrometheusPlugin();
app.plugin.use(prometheus);

app.start();
```

Register the plugin on **every** node: each node exposes its own metrics, and Prometheus scrapes each node.

## Scrape

| Route                             | Use it when                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /_metrics?format=prometheus` | the scraper can send query parameters (a Prometheus `scrape_config` with `params`) |
| `GET /_/metrics`                  | it cannot, such as Kubernetes `prometheus.io/path` annotations                      |

Both answer with the Prometheus text format, over HTTP only. `/_metrics` without `format=prometheus` keeps Kuzzle's JSON answer.

Access rights: the scraper needs `server:metrics` (first route) or `prometheus:metrics` (second route). For an anonymous scrape, give that right to the `anonymous` role. [Integrating in a stack](/modules/prometheus/1/guides/integrating-in-a-stack#give-the-scraper-its-rights) shows how to create a dedicated scraper user.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: kuzzle
    metrics_path: /_metrics
    params:
      format: [prometheus]
    static_configs:
      - targets: ['kuzzle:7512']
```

## Application metrics

The plugin owns the application's [Metrics](/modules/prometheus/1/api/metrics) instance: `prometheus.metrics`. Declare the application's metrics on it, at startup, and they are exposed with the Kuzzle metrics.

```typescript
const prometheus = new PrometheusPlugin({ prefix: 'iot_' });

export const payloads = prometheus.metrics.counter({
  name: 'payloads_received_total',
  help: 'Payloads received from devices',
  labelNames: ['protocol'],
});

// later, in a controller or a pipe
payloads.inc({ protocol: 'mqtt' });
```

::: warning
Never call `createMetrics()` in a Kuzzle application: its metrics would not be exposed.
:::

[Custom metrics](/modules/prometheus/1/guides/custom-metrics) covers types, labels and naming. The constructor options (`prefix`, `maxLabelSets`) are described in [PrometheusPlugin](/modules/prometheus/1/api/prometheus-plugin). Warnings, such as a metric reaching `maxLabelSets`, go to Kuzzle's logger.

## Configuration

The plugin reads the `plugins.prometheus` section of the Kuzzle configuration (`.kuzzlerc`) once, at startup:

```json
{
  "plugins": {
    "prometheus": {
      "core": {
        "nodeIdLabel": false
      },
      "labels": {
        "project": "acme",
        "environment": "production"
      }
    }
  }
}
```

As with any Kuzzle setting, environment variables override the file:

```bash
kuzzle_plugins__prometheus__labels__project=acme
```

Every key, its default and its effect: [Kuzzle configuration](/modules/prometheus/1/reference/kuzzle-configuration).

## Labels

Every metric of the node carries:

- `nodeId`: the Kuzzle node ID, new at each restart (unless `core.nodeIdLabel` is `false`);
- the common labels `project`, `environment`, `service`, from `labels` or from the `KUZZLE_PROMETHEUS_*` environment variables, `labels` winning (see [Common labels](/modules/prometheus/1/api/types/metrics-options#common-labels));
- every other pair of `labels`.

**Who sets them.** The plugin's constructor takes no label: in a Kuzzle backend, the deployment sets the three common labels, through `kuzzle_plugins__prometheus__labels__*` variables (or `labels` in the `.kuzzlerc` of each environment):

- `service`: `kuzzle`, for every Kuzzle backend. The program is Kuzzle; `project` tells the backends apart.
- `project` and `environment`: the backend and its environment.

```bash
kuzzle_plugins__prometheus__labels__service=kuzzle
kuzzle_plugins__prometheus__labels__project=acme
kuzzle_plugins__prometheus__labels__environment=production
```

When several sources give a label, a `kuzzle_plugins__prometheus__labels__*` variable wins over the `.kuzzlerc` file, which wins over `KUZZLE_PROMETHEUS_*`.

Keep `labels` values fixed for the life of the process, and do not use `nodeId`, `protocol`, `controller`, `action` or `status` as label names: the plugin uses them.

## Going further

- [Kuzzle metrics](/modules/prometheus/1/reference/kuzzle-metrics): every metric the plugin exposes, and PromQL examples.
- [Integrating in a stack](/modules/prometheus/1/guides/integrating-in-a-stack): a dedicated scraper user, Prometheus jobs for clusters, Kubernetes, Grafana dashboards.
- [Troubleshooting](/modules/prometheus/1/guides/troubleshooting).
