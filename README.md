# kuzzle-prometheus

Prometheus metrics for Kuzzle backends and any Node.js service (gateways, workers): one API, shared labels and naming conventions.

```ts
import http from "node:http";
import { createMetrics } from "kuzzle-prometheus";

const metrics = createMetrics({ service: "ingestion-gateway", prefix: "gateway_" });

const received = metrics.counter({
  name: "messages_received_total",
  help: "Messages received from devices",
  labelNames: ["protocol"],
});

received.inc({ protocol: "mqtt" });

// Expose GET /metrics for Prometheus to scrape
http.createServer(metrics.handler).listen(9464);
```

## Entry points

| Import | For | Kuzzle needed |
| --- | --- | --- |
| `kuzzle-prometheus` | any Node.js service: Node.js metrics, `/metrics` handler, custom metrics | no |
| `kuzzle-prometheus/kuzzle` | Kuzzle applications: the Kuzzle plugin built on the module | yes (`>=2.59.0 <3`, optional peer dependency) |

## Documentation

| Guide | Read it to |
| --- | --- |
| [Getting started](docs/getting-started.md) | expose metrics from a Node.js service in five minutes |
| [Custom metrics](docs/custom-metrics.md) | declare counters, gauges and histograms, pick names and labels |
| [Configuration](docs/configuration.md) | every option and environment variable |
| [Kuzzle plugin](docs/kuzzle.md) | expose a Kuzzle backend's metrics, add the application's own |
| [Kuzzle metrics reference](docs/kuzzle-metrics.md) | what each Kuzzle metric means, PromQL examples |
| [Integrating in a Kuzzle stack](docs/kuzzle-stack.md) | scraper rights, Prometheus jobs for a cluster or Kubernetes, Grafana dashboards, the demo stack |
| [Migrating from kuzzle-plugin-prometheus](docs/migrating-from-kuzzle-plugin-prometheus.md) | move a Kuzzle application from the deprecated plugin to `kuzzle-prometheus/kuzzle` |
| [Troubleshooting](docs/troubleshooting.md) | symptoms, causes and fixes |
| [For AI agents](docs/agents.md) | rules an agent follows when it adds metrics to an application |

The documentation ships in the npm package: `node_modules/kuzzle-prometheus/docs/`.

`kuzzle-prometheus/kuzzle` replaces the deprecated [`kuzzle-plugin-prometheus`](https://www.npmjs.com/package/kuzzle-plugin-prometheus): same metrics, routes and configuration.

## Requirements

Node.js 22.12+ or 24.

## Contributing

```sh
npm ci
npm test          # lint, types, unit tests
npm run build     # dist/
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): releases, versions and changelogs are produced by semantic-release from them. Contributors, human or agent, start with [AGENTS.md](AGENTS.md).

Design decisions and their history are recorded as ADRs under [`docs/adr-001/`](docs/adr-001) and onwards; the demo stack (Kuzzle, Prometheus, Grafana dashboards) is in [`demo/`](demo).

## License

[Apache-2.0](LICENSE)
