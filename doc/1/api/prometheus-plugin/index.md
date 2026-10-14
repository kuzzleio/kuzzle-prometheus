---
code: true
type: page
title: PrometheusPlugin
description: Kuzzle Prometheus API - PrometheusPlugin class
order: 300
---

# PrometheusPlugin

The Kuzzle plugin: Kuzzle metrics, API request durations, Node.js metrics, and a [Metrics](/modules/prometheus/1/api/metrics) instance for the application's own metrics.

```typescript
import { PrometheusPlugin } from 'kuzzle-prometheus/kuzzle';
```

`kuzzle-prometheus/kuzzle` also re-exports everything `kuzzle-prometheus` exports.

## Constructor

```typescript
constructor(options?: PrometheusPluginOptions)
```

### Parameters

- `options`: optional, `PrometheusPluginOptions`:

| Option         | Type     | Default | Description                                                                                                                       |
| -------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `prefix`       | `string` | `""`    | prepended to the application's metric names (not to Kuzzle's)                                                                     |
| `maxLabelSets` | `number` | `1000`  | label combinations accepted per application metric (see [Keep labels bounded](/modules/prometheus/1/guides/custom-metrics#keep-labels-bounded)) |

The rest of the configuration is read from the Kuzzle configuration: see [Kuzzle configuration](/modules/prometheus/1/reference/kuzzle-configuration).

```typescript
const prometheus = new PrometheusPlugin({ prefix: 'iot_' });
app.plugin.use(prometheus);
```

## Properties

### metrics

```typescript
readonly metrics: Metrics
```

The application's [Metrics](/modules/prometheus/1/api/metrics) instance. Declare the application's metrics on it, at startup: they are exposed with the Kuzzle metrics.

```typescript
export const payloads = prometheus.metrics.counter({
  name: 'payloads_received_total',
  help: 'Payloads received from devices',
  labelNames: ['protocol'],
});
```

Its common labels, `nodeId` and other `labels` are set when Kuzzle initializes the plugin, from the Kuzzle configuration.

### config

```typescript
config: {
  core: { monitorRequestDuration: boolean; nodeIdLabel: boolean; prefix: string; requestDurationBuckets: number[] };
  default: { enabled: boolean; prefix: string; eventLoopMonitoringPrecision: number; gcDurationBuckets: number[] };
  labels: Record<string, string>;
}
```

The resolved configuration, available once Kuzzle has initialized the plugin: the `plugins.prometheus` section merged over the defaults. `labels` values are converted to strings.

## Methods

### serveMetrics

```typescript
serveMetrics(request: KuzzleRequest): Promise<string | undefined>
```

The handler of `GET /_/metrics` (the `prometheus:metrics` action). Kuzzle calls it; an application does not need to.

## Exports

| Export                             | Description                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `DEFAULT_REQUEST_DURATION_BUCKETS` | default value of `core.requestDurationBuckets`, in milliseconds             |
| `PrometheusPluginConfiguration`    | type of the `plugins.prometheus` section of the Kuzzle configuration        |
| `PrometheusPluginOptions`          | type of the constructor options                                             |
