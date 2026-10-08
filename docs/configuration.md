# Configuration

`createMetrics(options)` options. All are optional.

| Option | Default | Description |
| --- | --- | --- |
| `service` | `KUZZLE_PROMETHEUS_SERVICE` | `service` label of every metric |
| `project` | `KUZZLE_PROMETHEUS_PROJECT` | `project` label of every metric |
| `environment` | `KUZZLE_PROMETHEUS_ENVIRONMENT` | `environment` label of every metric |
| `prefix` | `""` | prepended to the name of every custom metric |
| `maxLabelSets` | `1000` | label combinations accepted per metric before new ones are dropped (see [Custom metrics](custom-metrics.md#keep-labels-bounded)) |
| `logger` | `console` | receives warnings (`logger.warn(message)`); any object with a `warn` method, such as a `kuzzle-logger` instance |
| `defaultMetrics.enabled` | `true` | collect Node.js process metrics (CPU, memory, event loop lag, GC) |
| `defaultMetrics.prefix` | `""` | prefix of the Node.js process metrics; empty so that standard dashboards work |
| `defaultMetrics.eventLoopMonitoringPrecision` | `10` | event loop lag sampling, in milliseconds |
| `defaultMetrics.gcDurationBuckets` | `[0.001, 0.01, 0.1, 1, 2, 5]` | buckets of the GC duration histogram, in seconds |

## Common labels

`project`, `environment` and `service` are added to every metric, custom and Node.js alike, so that one dashboard or alert rule works for every service.

- An option wins over its environment variable.
- A label with no value (neither option nor variable) is left out.
- Values are fixed at `createMetrics` time.

Set `service` in code: it names the program. Let the deployment set `project` and `environment` through the environment variables.

## Example

```ts
import { createMetrics } from "kuzzle-prometheus";

const metrics = createMetrics({
  service: "ingestion-gateway",
  prefix: "gateway_",
  defaultMetrics: { eventLoopMonitoringPrecision: 20 },
});
```
