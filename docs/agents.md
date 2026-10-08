# kuzzle-prometheus — guide for AI agents

You are adding or changing Prometheus metrics in an application that depends on `kuzzle-prometheus`. Follow these rules; the human-oriented guides next to this file give the details.

## Find the existing instance first

An application has **one** `Metrics` instance. Search for `createMetrics(` (Node.js services) or for the Kuzzle plugin's instance (`kuzzle-prometheus/kuzzle`) and reuse it. Never call `createMetrics` a second time: two instances mean two registries, and only one is scraped.

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
- A current level (connections, queue size) → `gauge`.
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

## Checking your change

1. The application's tests pass: type errors on `inc` / `set` / `observe` usually mean a missing or unknown label.
2. Start the service and run `curl -s localhost:<port>/metrics | grep <name>`: the metric appears once a value has been recorded.

## Reference

- [Custom metrics](custom-metrics.md) — types, labels, naming rules, cardinality limit
- [Configuration](configuration.md) — `createMetrics` options and environment variables
- [Getting started](getting-started.md) — exposing `/metrics`
