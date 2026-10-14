---
code: false
type: page
order: 100
title: Getting started
description: Install Kuzzle Prometheus and expose the metrics of a Kuzzle application or of a Node.js service
---

# Getting Started

Kuzzle Prometheus exposes [Prometheus](https://prometheus.io/) metrics from Kuzzle applications and from any Node.js service, with one API and shared labels: one dashboard or alert rule works for every service.

The package has two entry points:

| Entry point                | For                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `kuzzle-prometheus/kuzzle` | a Kuzzle application: Kuzzle's metrics, API request durations, Node.js metrics and the application's own metrics |
| `kuzzle-prometheus`        | any other Node.js service: Node.js metrics and the service's own metrics, on a `/metrics` route           |

Requirements: Node.js 22.12+ or 24. The Kuzzle entry point requires Kuzzle `>=2.59.0 <3`.

## Which guide do I need?

| You want to...                                           | Read                                                                                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Monitor a Kuzzle application                             | [Kuzzle plugin](/modules/prometheus/1/guides/kuzzle-plugin)                                                           |
| Collect it with Prometheus and view it in Grafana        | [Integrating in a stack](/modules/prometheus/1/guides/integrating-in-a-stack)                                          |
| Replace `kuzzle-plugin-prometheus`                       | [Migrating from kuzzle-plugin-prometheus](/modules/prometheus/1/guides/migrating-from-kuzzle-plugin-prometheus)        |
| Monitor a Node.js service that is not a Kuzzle application | [In a Node.js service](#in-a-node-js-service), below                                                                |
| Add your own counters, gauges and histograms             | [Custom metrics](/modules/prometheus/1/guides/custom-metrics)                                                         |

## In a Kuzzle application

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

Once Kuzzle has started, the metrics are served at `GET /_metrics?format=prometheus`:

```bash
curl "http://localhost:7512/_metrics?format=prometheus"
```

The [Kuzzle plugin](/modules/prometheus/1/guides/kuzzle-plugin) guide covers the routes, access rights, configuration and application metrics.

## In a Node.js service

### 1. Install

```bash
npm install kuzzle-prometheus
```

### 2. Create one Metrics instance

Create it once, at startup, and share it across the service.

```typescript
// metrics.ts
import { createMetrics } from 'kuzzle-prometheus';

export const metrics = createMetrics({
  service: 'ingestion-gateway',
  prefix: 'gateway_',
});
```

`service` names this service in every metric. `project` and `environment` usually come from the environment (`KUZZLE_PROMETHEUS_PROJECT`, `KUZZLE_PROMETHEUS_ENVIRONMENT`), set by the deployment: see [Common labels](/modules/prometheus/1/api/types/metrics-options#common-labels).

Node.js process metrics (CPU, memory, event loop lag, GC) are collected from this point.

### 3. Expose /metrics

Prometheus pulls metrics: the service answers `GET /metrics`.

With the Node.js `http` module, on a dedicated port:

```typescript
import http from 'node:http';
import { metrics } from './metrics';

http.createServer(metrics.handler).listen(9464);
```

`metrics.handler` answers every path. To mount it on an existing server, route `GET /metrics` to it:

```typescript
// Express
app.get('/metrics', metrics.handler);

// Fastify, or any framework: render() returns the body and its content type
fastify.get('/metrics', async (_request, reply) => {
  const { contentType, body } = await metrics.render();
  return reply.type(contentType).send(body);
});
```

### 4. Count what matters

```typescript
const processed = metrics.counter({
  name: 'messages_processed_total',
  help: 'Messages processed, by outcome',
  labelNames: ['outcome'],
});

processed.inc({ outcome: 'ok' });
```

[Custom metrics](/modules/prometheus/1/guides/custom-metrics) covers gauges, histograms, naming and labels.

### 5. Check

```bash
curl -s localhost:9464/metrics | grep gateway_
```

```
# HELP gateway_messages_processed_total Messages processed, by outcome
# TYPE gateway_messages_processed_total counter
gateway_messages_processed_total{outcome="ok",project="acme",environment="production",service="ingestion-gateway"} 1
```
