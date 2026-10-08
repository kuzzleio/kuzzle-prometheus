# kuzzle-prometheus — guide for AI agents

You are adding or changing Prometheus metrics in an application that depends on `kuzzle-prometheus`. Follow these rules; the human-oriented guides next to this file give the details.

## Find the existing instance first

An application has **one** `Metrics` instance. Reuse it:

- Node.js service: search for `createMetrics(`.
- Kuzzle backend: search for `new PrometheusPlugin(` (`kuzzle-prometheus/kuzzle`); the instance is `<plugin>.metrics`. Never call `createMetrics` in a Kuzzle backend: its metrics would not be exposed.

Never create a second instance: two instances mean two registries, and only one is scraped.

Do not import `@prometheus-io/client` or `prom-client` in the application. Everything goes through the `Metrics` API.

## Declare metrics once, at module load

```ts
// Good: declared once, next to the code that updates it
const received = metrics.counter({
  name: "messages_received_total",
  help: "Messages received from devices",
  labelNames: ["protocol"],
});

export function onMessage(protocol: "mqtt" | "http") {
  received.inc({ protocol });
}
```

Never declare a metric inside a function that runs per request or per message: the second call throws (duplicate name).

## Choose the type

- Something happened → `counter`, name ends with `_total`.
- A current level (connections, queue size) → `gauge`; when that level can be read at any time (a connection state, a readiness flag), set it in the gauge's `collect` callback rather than on every change.
- A duration or a size → `histogram`, name ends with the unit in base units (`_seconds`, `_bytes`), with explicit `buckets`.

## Labels: the rule that matters most

A label value must come from a **small, fixed set** (protocol, status code, outcome, controller). Never use as a label value:

- an ID (device, user, tenant when unbounded, document, request);
- a URL or path containing IDs;
- an error message, a timestamp, any free text or user input.

If you need per-entity detail, it belongs in logs, not metrics. Past `maxLabelSets` combinations, the module drops new ones and logs a warning: treat that warning as a bug in the metric's labels.

Never add `project`, `environment` or `service` to `labelNames`: they are common labels, added automatically (declaring them throws).

## Names

- `snake_case`, without the service name or the prefix (the instance adds the prefix).
- Do not rename an existing metric: dashboards and alert rules depend on it. Add a new one instead, and say so in the change description.
- Kuzzle backends: do not redeclare what the plugin already measures (API request duration and status, connections, realtime rooms; see [Kuzzle metrics reference](kuzzle-metrics.md)).

## Checking your change

1. The application's tests pass: type errors on `inc` / `set` / `observe` usually mean a missing or unknown label.
2. Start the service and check the metric appears once a value has been recorded:
   - Node.js service: `curl -s localhost:<port>/metrics | grep <name>`;
   - Kuzzle backend: `curl -s "localhost:7512/_metrics?format=prometheus" | grep <name>`.

## Reference

- [Custom metrics](custom-metrics.md) — types, labels, naming rules, cardinality limit
- [Configuration](configuration.md) — `createMetrics` options and environment variables
- [Getting started](getting-started.md) — exposing `/metrics`
- [Kuzzle plugin](kuzzle.md) — the plugin, its configuration and `plugin.metrics`
