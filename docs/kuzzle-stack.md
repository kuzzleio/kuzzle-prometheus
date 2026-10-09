# Integrating the Kuzzle plugin in a stack

From an application to dashboards: register the plugin, give the scraper its rights, point Prometheus at every node, import the dashboards. Each step links to the reference documentation.

## 1. Register the plugin on every node

```sh
npm install kuzzle-prometheus
```

```typescript
import { Backend } from "kuzzle";
import { PrometheusPlugin } from "kuzzle-prometheus/kuzzle";

const app = new Backend("my-application");

const prometheus = new PrometheusPlugin();
app.plugin.use(prometheus);

app.start();
```

Coming from `kuzzle-plugin-prometheus` 4.x: see [Migrating from kuzzle-plugin-prometheus](migrating-from-kuzzle-plugin-prometheus.md).

- **Every node** runs the plugin, in the application all nodes share. A node without it answers `/_metrics?format=prometheus` in JSON and `/_/metrics` with a 404.
- **Each node exposes only its own metrics**: no aggregation across the cluster. Prometheus scrapes every node and aggregates with PromQL (`sum by (…)`).
- The application's own metrics go on `prometheus.metrics`: see [Kuzzle plugin → Application metrics](kuzzle.md#application-metrics).
- Configuration (`plugins.prometheus` in `.kuzzlerc` or `kuzzle_plugins__prometheus__*` variables): [Kuzzle plugin → Configuration](kuzzle.md#configuration).

Check, once Kuzzle has started:

```sh
curl "http://localhost:7512/_metrics?format=prometheus"
```

The answer is plain text starting with `# HELP`. JSON instead: see [Troubleshooting](troubleshooting.md).

## 2. Routes

| Route | Kuzzle action checked | Notes |
| --- | --- | --- |
| `GET /_metrics?format=prometheus` | `server:metrics` | Kuzzle's `server:metrics`, converted by the plugin. Without `format=prometheus`, Kuzzle's JSON. HTTP only. |
| `GET /_/metrics` | `prometheus:metrics` | For scrapers that cannot send query parameters. It calls `server:metrics` internally, through the plugin's embedded SDK: Kuzzle does not check the scraper's rights on that internal call. |

Both answer `200` with `Content-Type: text/plain; version=0.0.4; charset=utf-8`; the `X-Kuzzle-Node` header names the node that answered.

## 3. Give the scraper its rights

Out of the box, Kuzzle's `anonymous` role allows every action: scrapes work without credentials. Once you restrict it (any production deployment should), give the scraper a dedicated role:

```json
{
  "controllers": {
    "server": { "actions": { "metrics": true } },
    "prometheus": { "actions": { "metrics": true } }
  }
}
```

Keep only the line of the route you scrape, if you prefer. Then either:

- **Anonymous scrapes**: add these rights to the `anonymous` role. Anyone who reaches the port can read the metrics: acceptable when the Kuzzle port is not exposed outside a private network.
- **Authenticated scrapes** (recommended): a dedicated user, with an API key used as a bearer token. With an admin token in `$ADMIN`:

  ```sh
  # 1. The role above
  curl -X POST "http://kuzzle:7512/roles/prometheus-scraper/_create" \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d '{"controllers": {"server": {"actions": {"metrics": true}}, "prometheus": {"actions": {"metrics": true}}}}'

  # 2. A profile with that role
  curl -X POST "http://kuzzle:7512/profiles/prometheus-scraper/_create" \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d '{"policies": [{"roleId": "prometheus-scraper"}]}'

  # 3. A user with that profile (no password needed: it authenticates with its API key)
  curl -X POST "http://kuzzle:7512/users/prometheus-scraper/_create" \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d '{"content": {"profileIds": ["prometheus-scraper"]}}'

  # 4. An API key for that user, which never expires
  curl -X POST "http://kuzzle:7512/users/prometheus-scraper/api-keys/_create?expiresIn=-1" \
    -H "Authorization: Bearer $ADMIN" -H "Content-Type: application/json" \
    -d '{"description": "Prometheus scraper"}'
  ```

  The key is `result._source.token` in the last response; Kuzzle shows it only once. See Kuzzle's [API keys guide](https://docs.kuzzle.io/core/2/guides/advanced/api-keys/).

Without the right, Kuzzle answers `401` to an anonymous scrape and `403` to an authenticated one.

## 4. Point Prometheus at every node

**Never scrape through a load balancer** or a Kubernetes Service: each scrape would reach a random node, series would jump between nodes and counters would look like resets.

### One node

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: kuzzle
    metrics_path: /_metrics
    params:
      format: ["prometheus"]
    static_configs:
      - targets: ["kuzzle:7512"]
```

For an authenticated scrape, add the API key:

```yaml
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/kuzzle-api-key # or `credentials: <key>`
```

### Several nodes with Docker Compose

List each node by its container name (`<project>-<service>-<index>`), not the service name, which Docker's DNS may resolve to any replica:

```yaml
    static_configs:
      - targets:
          - "kuzzle-prometheus-demo-kuzzle-1:7512"
          - "kuzzle-prometheus-demo-kuzzle-2:7512"
          - "kuzzle-prometheus-demo-kuzzle-3:7512"
```

`dns_sd_configs` with `tasks.<service>` (Docker Swarm) or `docker_sd_configs` discover the replicas automatically.

### Kubernetes

Scrape the **pods**. With pod annotations (honoured by the common Prometheus Helm charts' `kubernetes-pods` job), use `/_/metrics`: annotations cannot carry query parameters.

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/path: /_/metrics
    prometheus.io/port: "7512"
```

Annotations cannot carry credentials either: they need anonymous scrapes. For authenticated scrapes, use a `PodMonitor` of the Prometheus Operator:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: kuzzle
spec:
  selector:
    matchLabels:
      app: kuzzle
  podMetricsEndpoints:
    - port: http # the name of the container port 7512
      path: /_metrics
      params:
        format: ["prometheus"]
      authorization:
        type: Bearer
        credentials:
          name: kuzzle-prometheus-api-key
          key: token
```

Set the `project` and `environment` labels in the deployment, so that one dashboard or alert rule works across stacks:

```yaml
env:
  - name: kuzzle_plugins__prometheus__labels__project
    value: acme
  - name: kuzzle_plugins__prometheus__labels__environment
    value: production
```

### Scrape interval

10 to 30 seconds suits most deployments: each scrape is one cheap `server:metrics` call. Use a `rate()` window of at least 4 times the interval (`[1m]` for 15 s).

### Cardinality

Series per node, with the default configuration:

- Kuzzle metrics: about 6, plus one per connected protocol;
- Node.js metrics: about 100 (with the event loop utilization summary and histogram);
- request histogram: 12 per controller × action × protocol × status combination actually used. It grows with the API surface clients use: 40 actions over 2 protocols with 3 statuses each give about 2,900 series.

Every restart creates a new `nodeId`, hence a new set of series; the old ones go stale after 5 minutes. Frequent restarts (autoscaling, crash loops) multiply the series Prometheus stores over its retention.

## 5. Grafana dashboards

Two dashboards are in [`demo/config/grafana/dashboards/`](../demo/config/grafana/dashboards) (in the repository, not in the npm package), both with a `nodeId` filter:

- `demo.json` ("Kuzzle"): connections per node and protocol, concurrent and pending requests, realtime subscriptions, requests, latency and 5xx errors per node and per API action;
- `nodejs.json` ("NodeJS process"): CPU, event loop lag, Node.js version, restarts, memory, active handles and requests, heap per space.

Import them through the Grafana UI, its API or its provisioning, as the demo stack does. They expect the default prefixes (`kuzzle_` for Kuzzle metrics, none for Node.js metrics) and a Prometheus datasource named `Prometheus`.

## 6. Try it locally

The repository's demo stack runs all of the above: Kuzzle with the plugin (`demo/app.ts`), Prometheus scraping three nodes directly, Grafana with the dashboards provisioned. From a clone of [kuzzleio/kuzzle-prometheus](https://github.com/kuzzleio/kuzzle-prometheus):

```sh
docker compose -f demo/docker-compose.yml up -d --wait --scale kuzzle=3
```

| Service | Address |
| --- | --- |
| Kuzzle, behind Traefik | <http://localhost:7512> (HTTP, WebSocket), `localhost:1883` (MQTT) |
| Prometheus | <http://localhost:9090> |
| Grafana | <http://localhost:3000> (`admin` / `admin`) |

Make requests (`curl http://localhost:7512/_now`, an SDK) and watch the dashboards; `GET http://localhost:7512/_/testing/failure` produces a 500. With a single Kuzzle (no `--scale`), Prometheus shows two targets down. Stop with `docker compose -f demo/docker-compose.yml down -v`.

The stack runs `npm ci` in the mounted repository: on macOS, run `npm ci` again on the host afterwards (Linux binaries).

## Reference

| Document | Content |
| --- | --- |
| [Kuzzle plugin](kuzzle.md) | configuration, labels, application metrics |
| [Kuzzle metrics reference](kuzzle-metrics.md) | every metric, PromQL examples |
| [Custom metrics](custom-metrics.md) | declaring the application's metrics |
| [Troubleshooting](troubleshooting.md) | symptoms, causes and fixes |
