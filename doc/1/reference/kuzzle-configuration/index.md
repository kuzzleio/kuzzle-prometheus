---
code: false
type: page
order: 100
title: Kuzzle configuration
description: The plugins.prometheus section of the Kuzzle configuration
---

# Kuzzle Configuration

The `plugins.prometheus` section of the Kuzzle configuration (`.kuzzlerc`), read once, at startup. It is deep-merged over the defaults; an array replaces the default array.

```json
{
  "plugins": {
    "prometheus": {
      "core": {
        "monitorRequestDuration": true,
        "nodeIdLabel": true,
        "prefix": "kuzzle_",
        "requestDurationBuckets": [0.1, 5, 15, 50, 100, 200, 300, 400, 500]
      },
      "default": {
        "enabled": true,
        "prefix": "",
        "eventLoopMonitoringPrecision": 10,
        "gcDurationBuckets": [0.001, 0.01, 0.1, 1, 2, 5]
      },
      "labels": {
        "project": "acme",
        "environment": "production"
      }
    }
  }
}
```

| Key | Default | Effect |
| --- | --- | --- |
| `core.prefix` | `"kuzzle_"` | prefix of the Kuzzle metrics and of the request duration histogram; the shipped dashboards expect `kuzzle_` |
| `core.monitorRequestDuration` | `true` | records every API request in `<prefix>api_request_duration_ms` |
| `core.nodeIdLabel` | `true` | adds the `nodeId` label to every metric; `false` when the scrape target already identifies the node (a Kubernetes pod), since each restart opens new series |
| `core.requestDurationBuckets` | `[0.1, 5, 15, 50, 100, 200, 300, 400, 500]` | buckets of that histogram, in milliseconds, ascending |
| `default.enabled` | `true` | Node.js process metrics |
| `default.prefix` | `""` | prefix of the Node.js metrics; empty so that standard dashboards work |
| `default.eventLoopMonitoringPrecision` | `10` | event loop lag sampling, in milliseconds |
| `default.gcDurationBuckets` | `[0.001, 0.01, 0.1, 1, 2, 5]` | GC duration buckets, in seconds |
| `labels` | `{}` | labels added to every metric of the node |

As with any Kuzzle setting, environment variables override the file, with `__` as separator and `*json:` for arrays:

```bash
kuzzle_plugins__prometheus__labels__project=acme
kuzzle_plugins__prometheus__core__requestDurationBuckets='*json:[5,50,500,5000]'
```

If you register the plugin under another name (`app.plugin.use(plugin, { name: "metrics" })`), its section is named after it.

## Environment

The common labels can also come from the environment, `labels` winning:

| Variable                        | Label         |
| ------------------------------- | ------------- |
| `KUZZLE_PROMETHEUS_PROJECT`     | `project`     |
| `KUZZLE_PROMETHEUS_ENVIRONMENT` | `environment` |
| `KUZZLE_PROMETHEUS_SERVICE`     | `service`     |

See [Kuzzle plugin → Labels](/modules/prometheus/1/guides/kuzzle-plugin#labels).
