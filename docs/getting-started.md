# Getting started

Expose Prometheus metrics from a Node.js service. For a Kuzzle backend, use the Kuzzle plugin instead (`kuzzle-prometheus/kuzzle`).

## 1. Install

```sh
npm install kuzzle-prometheus
```

Node.js 22 or 24.

## 2. Create one `Metrics` instance

Create it once, at startup, and share it across the service.

```ts
// metrics.ts
import { createMetrics } from "kuzzle-prometheus";

export const metrics = createMetrics({
  service: "ingestion-gateway",
  prefix: "gateway_",
});
```

`service` names this service in every metric. `project` and `environment` usually come from the environment (`KUZZLE_PROMETHEUS_PROJECT`, `KUZZLE_PROMETHEUS_ENVIRONMENT`), set by the deployment: see [Configuration](configuration.md).

Node.js process metrics (CPU, memory, event loop lag, GC) are collected from this point.

## 3. Expose `/metrics`

Prometheus pulls metrics: the service answers `GET /metrics`.

With the Node.js `http` module, on a dedicated port:

```ts
import http from "node:http";
import { metrics } from "./metrics";

http.createServer(metrics.handler).listen(9464);
```

`metrics.handler` answers every path. To mount it on an existing server, route `GET /metrics` to it:

```ts
// Express
app.get("/metrics", metrics.handler);

// Fastify, or any framework: render() returns the body and its content type
fastify.get("/metrics", async (_request, reply) => {
  const { contentType, body } = await metrics.render();
  return reply.type(contentType).send(body);
});
```

## 4. Count what matters

```ts
const processed = metrics.counter({
  name: "messages_processed_total",
  help: "Messages processed, by outcome",
  labelNames: ["outcome"],
});

processed.inc({ outcome: "ok" });
```

[Custom metrics](custom-metrics.md) covers gauges, histograms, naming and labels.

## 5. Check

```sh
curl -s localhost:9464/metrics | grep gateway_
```

```
# HELP gateway_messages_processed_total Messages processed, by outcome
# TYPE gateway_messages_processed_total counter
gateway_messages_processed_total{outcome="ok",project="acme",environment="production",service="ingestion-gateway"} 1
```
