# Troubleshooting

Start by fetching what Prometheus scrapes, from where Prometheus runs:

```sh
curl -i http://<service>:<port>/metrics                          # Node.js service
curl -i "http://<node>:7512/_metrics?format=prometheus"          # Kuzzle backend
```

## Any service

### `createMetrics` or a declaration throws at startup

The message says which rule a name or a label breaks: see [Custom metrics → Naming rules](custom-metrics.md#naming-rules). `is already declared` means the declaration runs twice: move it to module level, out of the function that runs per request.

### A custom metric is missing

- A metric with labels appears only once a value has been recorded for a label set.
- It was declared on another `Metrics` instance than the one served on `/metrics`. An application has one instance; in a Kuzzle backend it is `plugin.metrics`, never `createMetrics()`.

### `Metric "…" reached 1000 label combinations` in the logs

One of the metric's labels takes unbounded values (an ID, a URL, free text): new combinations are dropped and counted in `kuzzle_prometheus_label_sets_rejected_total{metric="…"}`. Fix the label in the code, do not raise `maxLabelSets`. See [Custom metrics → Keep labels bounded](custom-metrics.md#keep-labels-bounded).

### `project`, `environment` or `service` is missing

The label has no value: set the option, or the `KUZZLE_PROMETHEUS_*` variable in the deployment (in a Kuzzle backend, also `labels`). See [Configuration → Common labels](configuration.md#common-labels).

### Node.js metrics are absent or renamed

`defaultMetrics.enabled` (`default.enabled` in Kuzzle) is `false`, or a prefix changed their names: dashboards built for the unprefixed names then show nothing.

## Kuzzle backend

### `/_metrics?format=prometheus` returns JSON

| Cause | Fix |
| --- | --- |
| The plugin is not loaded on this node (`GET /_/metrics` returns 404) | Register it with `app.plugin.use()` before `app.start()`, on every node. |
| `format` is missing or misspelt | `format=prometheus`, lowercase; in Prometheus, `params: { format: ["prometheus"] }`. |
| The request did not come over HTTP | Over WebSocket or MQTT, `server:metrics` always returns JSON. |

### 401 or 403

`401`: the scrape is anonymous and the `anonymous` role lacks the right, or the API key is invalid or expired. `403`: the scraper's user lacks the right on `server:metrics` (route `/_metrics`) or `prometheus:metrics` (route `/_/metrics`).

### 404 on `/_/metrics`

The plugin is not loaded on this node, or a reverse proxy in front of Kuzzle does not forward the `/_/` path.

### Kuzzle refuses to start: version mismatch

The plugin requires Kuzzle `>=2.59.0 <3.0.0`; Kuzzle checks it when the plugin loads, and npm 7+ refuses the install beforehand (`ERESOLVE`).

### Series disappear and reappear with another `nodeId`

Expected: Kuzzle generates a new node ID at each start. Chart per `instance` or `job` rather than per `nodeId` over long periods. Many `nodeId` values in a short time point to restarting nodes.

### Metrics of a node are missing, or counters keep resetting

Prometheus scrapes through a load balancer or a Kubernetes Service and reaches a different node at each scrape. Scrape every node directly.

### `kuzzle_api_request_duration_ms` is absent

- `core.monitorRequestDuration` is `false`.
- No API request completed since the node started: the histogram only shows label combinations already seen. The scrape itself creates the first series for the next scrape.

### Request duration quantiles are stuck at the highest bucket

Slower requests all land in `+Inf`, and `histogram_quantile` cannot return more than the highest bucket (500 ms by default). Add larger buckets with `core.requestDurationBuckets`; meanwhile `_sum / _count` gives the average.

### Too many series

The request histogram multiplies with controllers, actions, protocols and statuses, and every restart creates a new `nodeId`. `core.monitorRequestDuration: false` removes the histogram; fewer buckets reduce it.
