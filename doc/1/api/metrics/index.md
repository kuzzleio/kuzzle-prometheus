---
code: true
type: page
title: Metrics
description: Kuzzle Prometheus API - Metrics class
order: 200
---

# Metrics

The metrics of one application: declares custom metrics and renders all of them in the Prometheus text format.

```typescript
import { Metrics } from 'kuzzle-prometheus';
```

Get it from [createMetrics](/modules/prometheus/1/api/create-metrics) in a Node.js service, or from [`prometheus.metrics`](/modules/prometheus/1/api/prometheus-plugin#metrics) in a Kuzzle application. An application has one instance.

## Properties

### commonLabels

```typescript
get commonLabels(): Readonly<Record<string, string>>
```

Labels added to every metric of this instance: the [common labels](/modules/prometheus/1/api/types/metrics-options#common-labels) that have a value and, in a Kuzzle application, `nodeId` and the configured `labels`.

### prefix

```typescript
readonly prefix: string
```

Prepended to the name of every custom metric.

### maxLabelSets

```typescript
readonly maxLabelSets: number
```

Label combinations accepted per metric before new ones are dropped (see [Keep labels bounded](/modules/prometheus/1/guides/custom-metrics#keep-labels-bounded)).

### handler

```typescript
readonly handler: (request: IncomingMessage, response: ServerResponse) => void
```

A Node.js `http` / Express handler that answers with [render()](#render), whatever the path. If rendering fails, it answers `500` and logs a warning.

```typescript
http.createServer(metrics.handler).listen(9464);
app.get('/metrics', metrics.handler); // Express
```

## Methods

Declaration methods throw when the configuration breaks a [naming rule](/modules/prometheus/1/guides/custom-metrics#naming-rules) or when the name is already declared. Declare each metric once, at startup, and keep the returned object.

### counter

```typescript
counter<L extends string>(configuration: MetricConfiguration<L>): Counter<L>
```

Declares a counter. Its name must end with `_total`.

- `configuration`: see [MetricConfiguration](/modules/prometheus/1/api/types/metric-configuration).
- Returns a [Counter](/modules/prometheus/1/api/types/metric-types#counter).

```typescript
const errors = metrics.counter({
  name: 'decode_errors_total',
  help: 'Payloads that could not be decoded',
  labelNames: ['protocol'],
});

errors.inc({ protocol: 'mqtt' });
```

### gauge

```typescript
gauge<L extends string>(configuration: GaugeConfiguration<L>): Gauge<L>
```

Declares a gauge, optionally set at scrape time by a `collect` callback.

- `configuration`: see [GaugeConfiguration](/modules/prometheus/1/api/types/metric-configuration#gaugeconfiguration).
- Returns a [Gauge](/modules/prometheus/1/api/types/metric-types#gauge).

```typescript
metrics.gauge({
  name: 'broker_connected',
  help: 'Whether the broker connection is up (1) or not (0)',
  collect: (gauge) => gauge.set(broker.isConnected() ? 1 : 0),
});
```

### histogram

```typescript
histogram<L extends string>(configuration: HistogramConfiguration<L>): Histogram<L>
```

Declares a histogram.

- `configuration`: see [HistogramConfiguration](/modules/prometheus/1/api/types/metric-configuration#histogramconfiguration).
- Returns a [Histogram](/modules/prometheus/1/api/types/metric-types#histogram).

```typescript
const duration = metrics.histogram({
  name: 'decode_duration_seconds',
  help: 'Time to decode a payload',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
});

const stop = duration.startTimer();
decode(payload);
stop();
```

### render

```typescript
render(): Promise<RenderedMetrics>
```

Runs the `collect` callbacks of the gauges, then renders every metric of this instance in the Prometheus text format.

Returns a `RenderedMetrics` object:

| Property      | Type     | Description                                  |
| ------------- | -------- | -------------------------------------------- |
| `contentType` | `string` | the `Content-Type` header to answer with     |
| `body`        | `string` | the metrics, in the Prometheus text format   |

```typescript
fastify.get('/metrics', async (_request, reply) => {
  const { contentType, body } = await metrics.render();
  return reply.type(contentType).send(body);
});
```
