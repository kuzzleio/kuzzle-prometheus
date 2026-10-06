# kuzzle-prometheus

Prometheus metrics for Kuzzle backends and any Node.js service (gateways, workers): one API, shared labels and naming conventions.

> **Work in progress.** This package is being extracted from [`kuzzle-plugin-prometheus`](https://github.com/kuzzleio/kuzzle-plugin-prometheus). The design is recorded in its [ADR-0002](https://github.com/kuzzleio/kuzzle-plugin-prometheus/blob/master/docs/adr-002/ADR-0002-generic-prometheus-module.md). Nothing is published on npm yet.

## Entry points

| Import | For | Kuzzle needed |
| --- | --- | --- |
| `kuzzle-prometheus` | any Node.js service: registry, default metrics, `/metrics` handler, custom metrics | no |
| `kuzzle-prometheus/kuzzle` | Kuzzle applications: the Kuzzle plugin built on the module | yes (`>=2.59.0 <3`, optional peer dependency) |

Every metric carries the common labels `project`, `environment` and `service`.

## Requirements

Node.js 22 or 24.

## Development

```sh
npm ci
npm test          # lint, types, unit tests
npm run build     # dist/
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/): releases, versions and changelogs are produced by semantic-release from them.

## License

[Apache-2.0](LICENSE)
