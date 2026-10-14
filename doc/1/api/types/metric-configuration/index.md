---
code: true
type: page
title: MetricConfiguration interface
description: Kuzzle Prometheus API - MetricConfiguration, GaugeConfiguration and HistogramConfiguration interfaces
order: 200
---

# MetricConfiguration

Configuration of a custom metric, given to the declaration methods of [Metrics](/modules/prometheus/1/api/metrics).

```typescript
import {
  MetricConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
} from 'kuzzle-prometheus';
```

`L` is the union of the label names: TypeScript infers it from `labelNames`.

## MetricConfiguration

Used by `counter()`; the base of the two others.

| Property     | Type           | Description                                                                                                                         |
| ------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `name`       | `string`       | `snake_case`, without the instance prefix; a counter's name ends with `_total` (see [Naming rules](/modules/prometheus/1/guides/custom-metrics#naming-rules)) |
| `help`       | `string`       | description shown by Prometheus and Grafana                                                                                        |
| `labelNames` | `readonly L[]` | optional, the labels each call must give; never `project`, `environment` or `service`                                               |

## GaugeConfiguration

Used by `gauge()`. `MetricConfiguration`, plus:

| Property  | Type                                         | Description                                                                                                                                                                                       |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collect` | `(gauge: Gauge<L>) => void \| Promise<void>` | optional, called at every scrape, before rendering, to set the gauge from a current state. If it throws, or does not settle within 5 seconds, the error is logged and the gauge keeps its previous values. |

## HistogramConfiguration

Used by `histogram()`. `MetricConfiguration`, plus:

| Property  | Type       | Default                                                  | Description                                          |
| --------- | ---------- | -------------------------------------------------------- | ---------------------------------------------------- |
| `buckets` | `number[]` | `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]` | upper bounds of the buckets, in the unit of the metric |
