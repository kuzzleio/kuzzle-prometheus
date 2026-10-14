---
code: true
type: page
title: createMetrics
description: Kuzzle Prometheus API - createMetrics function
order: 100
---

# createMetrics

Creates the [Metrics](/modules/prometheus/1/api/metrics) instance of a Node.js service. Call it once, at startup, and share the instance.

```typescript
import { createMetrics } from 'kuzzle-prometheus';
```

::: warning
In a Kuzzle application, use the instance owned by the plugin, [`prometheus.metrics`](/modules/prometheus/1/api/prometheus-plugin#metrics), instead: the metrics of an instance created with `createMetrics()` are not exposed by Kuzzle.
:::

## Signature

```typescript
function createMetrics(options?: MetricsOptions): Metrics
```

### Parameters

- `options`: optional, see [MetricsOptions](/modules/prometheus/1/api/types/metrics-options).

### Returns

A [Metrics](/modules/prometheus/1/api/metrics) instance. Node.js process metrics are collected from this point, unless `defaultMetrics.enabled` is `false`.

### Throws

When an option is invalid, for example a `prefix` that is not `snake_case`.

## Example

```typescript
import { createMetrics } from 'kuzzle-prometheus';

export const metrics = createMetrics({
  service: 'ingestion-gateway',
  prefix: 'gateway_',
  defaultMetrics: { eventLoopMonitoringPrecision: 20 },
});
```
