# Custom metrics

Declare metrics on the service's `Metrics` instance (see [Getting started](getting-started.md)). Declare each metric **once**, at startup, and keep the returned object: declaring the same name twice throws.

## Which type?

| You want | Type | Example |
| --- | --- | --- |
| how many times something happened | `counter` (only goes up) | messages received, errors |
| a value that goes up and down | `gauge` | open connections, queue size |
| how long or how big something is | `histogram` | request duration, payload size |

Prometheus computes rates from counters (`rate(x_total[5m])`): never use a gauge to count events.

## Counter

```ts
const errors = metrics.counter({
  name: "decode_errors_total",
  help: "Payloads that could not be decoded",
  labelNames: ["protocol"],
});

errors.inc({ protocol: "mqtt" });     // +1
errors.inc({ protocol: "http" }, 3);  // +3
```

## Gauge

```ts
const queue = metrics.gauge({
  name: "queue_size",
  help: "Messages waiting to be processed",
});

queue.set(42);
queue.inc();
queue.dec();
```

A metric without `labelNames` takes no labels argument.

### Set at scrape time

When the value is a state you can read at any moment (a connection, a readiness flag, a pool size), give the gauge a `collect` callback instead of updating it on every change. It runs at every scrape, before rendering:

```ts
metrics.gauge({
  name: "broker_connected",
  help: "Whether the broker connection is up (1) or not (0)",
  collect: (gauge) => gauge.set(broker.isConnected() ? 1 : 0),
});
```

`collect` may be async; keep it fast, since every scrape waits for it. If it throws, the error goes to the logger and the gauge keeps its previous values: the rest of the scrape is not affected.

## Histogram

```ts
const duration = metrics.histogram({
  name: "decode_duration_seconds",
  help: "Time to decode a payload",
  labelNames: ["protocol"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
});

duration.observe({ protocol: "mqtt" }, 0.004);

// Or time a block of code
const stop = duration.startTimer({ protocol: "mqtt" });
decode(payload);
stop();
```

Pick `buckets` around the values you expect: a histogram can only tell which bucket a value fell into.

## Labels are typed

`labelNames` sets the labels each call must give, checked by TypeScript:

```ts
errors.inc({ protocol: "mqtt" });   // ok
errors.inc({ proto: "mqtt" });      // type error: unknown label
errors.inc();                       // type error: protocol is missing
```

## Naming rules

The module enforces them when the metric is declared (it throws otherwise):

- `snake_case`: lowercase letters, digits and `_`.
- Counters end with `_total`.
- `labelNames` never repeat the common labels (`project`, `environment`, `service`): they are added to every metric already.

Recommended:

- Put the unit in the name, in base units: `_seconds`, `_bytes`.
- Do not put the service name in metric names: the `prefix` and the `service` label carry it.

The `prefix` given to `createMetrics` is prepended to every name: `decode_errors_total` becomes `gateway_decode_errors_total`.

## Keep labels bounded

Every distinct combination of label values is a separate time series in Prometheus. A label whose values are unbounded (a device ID, a user ID, a URL with IDs in it, an error message) will eventually overload Prometheus.

- Good label values: a protocol, a status code, an outcome, a controller name.
- Bad label values: anything that comes from user input or identifies one entity.

To protect Prometheus, each metric accepts at most `maxLabelSets` combinations (default: 1000, see [Configuration](configuration.md)). Past that limit, new combinations are **dropped** (existing ones keep working), a warning is logged once for that metric, and `kuzzle_prometheus_label_sets_rejected_total{metric="…"}` counts the drops. A drop is a bug to fix in the code that declares the metric, not a limit to raise.

## Business metrics

Product metrics (IoT devices, rules, ingestion) are declared by the product that owns them, with this API. A tenant label is allowed there when it is bounded: name it `tenant`.
