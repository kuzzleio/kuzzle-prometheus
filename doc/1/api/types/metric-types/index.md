---
code: true
type: page
title: Counter, Gauge, Histogram
description: Kuzzle Prometheus API - Counter, Gauge and Histogram types
order: 300
---

# Counter, Gauge, Histogram

The objects returned by the declaration methods of [Metrics](/modules/prometheus/1/api/metrics).

```typescript
import { Counter, Gauge, Histogram, LabelValues } from 'kuzzle-prometheus';
```

Their methods depend on the metric's labels:

- a metric declared without `labelNames` takes no labels argument;
- otherwise, every method takes the label values first, as a `LabelValues<L>` object (`Record<L, string | number>`) that must give **every** label.

```typescript
const errors = metrics.counter({
  name: 'decode_errors_total',
  help: 'Payloads that could not be decoded',
  labelNames: ['protocol'],
});

errors.inc({ protocol: 'mqtt' }); // ok
errors.inc({ proto: 'mqtt' }); // type error: unknown label
errors.inc(); // type error: protocol is missing
```

A label combination past `maxLabelSets` is dropped (see [Keep labels bounded](/modules/prometheus/1/guides/custom-metrics#keep-labels-bounded)).

## Counter

| Without labels             | With labels                                     | Description                        |
| -------------------------- | ----------------------------------------------- | ---------------------------------- |
| `inc(value?: number): void` | `inc(labels: LabelValues<L>, value?: number): void` | adds `value` (default `1`) |

## Gauge

| Without labels              | With labels                                         | Description                        |
| --------------------------- | --------------------------------------------------- | ---------------------------------- |
| `set(value: number): void`  | `set(labels: LabelValues<L>, value: number): void`  | sets the value                     |
| `inc(value?: number): void` | `inc(labels: LabelValues<L>, value?: number): void` | adds `value` (default `1`)         |
| `dec(value?: number): void` | `dec(labels: LabelValues<L>, value?: number): void` | subtracts `value` (default `1`)    |

## Histogram

| Without labels                  | With labels                                            | Description                                                                                    |
| ------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `observe(value: number): void`  | `observe(labels: LabelValues<L>, value: number): void` | records a value                                                                                |
| `startTimer(): () => number`    | `startTimer(labels: LabelValues<L>): () => number`     | starts a timer; the returned function records the elapsed time, in seconds, and returns it      |

```typescript
const duration = metrics.histogram({
  name: 'decode_duration_seconds',
  help: 'Time to decode a payload',
  labelNames: ['protocol'],
});

const stop = duration.startTimer({ protocol: 'mqtt' });
decode(payload);
const seconds = stop();
```
