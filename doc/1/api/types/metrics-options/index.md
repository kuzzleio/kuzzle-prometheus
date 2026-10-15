---
code: true
type: page
title: MetricsOptions interface
description: Kuzzle Prometheus API - MetricsOptions interface
order: 100
---

# MetricsOptions

Options of [createMetrics](/modules/prometheus/1/api/create-metrics). All are optional.

```typescript
import { MetricsOptions } from 'kuzzle-prometheus';
```

In a Kuzzle application, the equivalent settings come from the [Kuzzle configuration](/modules/prometheus/1/reference/kuzzle-configuration) and the [PrometheusPlugin](/modules/prometheus/1/api/prometheus-plugin) constructor.

## Properties

| Property                                      | Type            | Default                         | Description                                                                                                                                         |
| --------------------------------------------- | --------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `service`                                     | `string`        | `KUZZLE_PROMETHEUS_SERVICE`     | `service` label of every metric                                                                                                                     |
| `project`                                     | `string`        | `KUZZLE_PROMETHEUS_PROJECT`     | `project` label of every metric                                                                                                                     |
| `environment`                                 | `string`        | `KUZZLE_PROMETHEUS_ENVIRONMENT` | `environment` label of every metric                                                                                                                 |
| `prefix`                                      | `string`        | `""`                            | prepended to the name of every custom metric                                                                                                        |
| `maxLabelSets`                                | `number`        | `1000`                          | label combinations accepted per metric before new ones are dropped (see [Keep labels bounded](/modules/prometheus/1/guides/custom-metrics#keep-labels-bounded)) |
| `logger`                                      | `MetricsLogger` | `console`                       | receives warnings (`logger.warn(message)`): any object with a `warn` method, such as a [Kuzzle Logger](/modules/logger/1) instance               |
| `defaultMetrics.enabled`                      | `boolean`       | `true`                          | collect Node.js process metrics (CPU, memory, event loop lag, GC)                                                                                   |
| `defaultMetrics.prefix`                       | `string`        | `""`                            | prefix of the Node.js process metrics; empty so that standard dashboards work                                                                       |
| `defaultMetrics.eventLoopMonitoringPrecision` | `number`        | `10`                            | event loop lag sampling, in milliseconds                                                                                                            |
| `defaultMetrics.gcDurationBuckets`            | `number[]`      | `[0.001, 0.01, 0.1, 1, 2, 5]`   | buckets of the GC duration histogram, in seconds                                                                                                    |

## Common labels

`project`, `environment` and `service` are added to every metric, custom and Node.js alike, so that one dashboard or alert rule works for every service. They are exported as `COMMON_LABELS`.

- An option wins over its environment variable.
- A label with no value (neither option nor variable) is left out.
- Values are fixed at `createMetrics` time.

Set `service` in code: it names the program. Let the deployment set `project` and `environment` through the environment variables. A Kuzzle backend is the exception: the deployment sets all three, see [Kuzzle plugin → Labels](/modules/prometheus/1/guides/kuzzle-plugin#labels).

### When the collection platform sets the same labels

Many platforms add their own `environment` or `service` (a cluster, a namespace) to every series, and the two values mean different things. What happens then depends on where the platform sets them:

- as a target label (service discovery, `relabel_configs`): Prometheus keeps the platform's value and renames the module's one to `exported_environment`, unless `honor_labels: true` keeps the module's;
- after the scrape (`metric_relabel_configs`, a Grafana Alloy `prometheus.relabel`, a remote-write pipeline): the module's value is replaced without warning, and `honor_labels` cannot help.

Settle it before collecting: let a single side own each label, and rename the other (for example `cluster` or `namespace` on the platform side), so that queries joining both keep working.

## Example

```typescript
import { createMetrics } from 'kuzzle-prometheus';

const metrics = createMetrics({
  service: 'ingestion-gateway',
  prefix: 'gateway_',
  defaultMetrics: { eventLoopMonitoringPrecision: 20 },
});
```
