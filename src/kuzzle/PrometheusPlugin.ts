import * as client from "@prometheus-io/client";
import {
  Plugin,
  type JSONObject,
  type KuzzleRequest,
  type PluginContext,
} from "kuzzle";

import { completeConfiguration, Metrics, registryOf } from "../metrics";
import type { MetricsLogger } from "../types";

export const DEFAULT_REQUEST_DURATION_BUCKETS = [
  0.1, 5, 15, 50, 100, 200, 300, 400, 500,
];

/**
 * The `plugins.prometheus` section of Kuzzle's configuration
 * (docs/kuzzle.md#configuration).
 */
export type PrometheusPluginConfiguration = {
  core?: {
    /**
     * Record every API request in `<prefix>api_request_duration_ms`.
     * @default true
     */
    monitorRequestDuration?: boolean;

    /**
     * Prefix of the Kuzzle metrics and of the request duration histogram.
     * @default "kuzzle_"
     */
    prefix?: string;

    /**
     * Buckets of the request duration histogram, in milliseconds.
     * @default [0.1, 5, 15, 50, 100, 200, 300, 400, 500]
     */
    requestDurationBuckets?: number[];
  };
  default?: {
    /**
     * @default true
     */
    enabled?: boolean;

    /**
     * @default ""
     */
    prefix?: string;

    /**
     * @default 10
     */
    eventLoopMonitoringPrecision?: number;

    /**
     * @default [0.001, 0.01, 0.1, 1, 2, 5]
     */
    gcDurationBuckets?: number[];
  };

  /**
   * Labels added to every metric of the node. `project`, `environment` and
   * `service` are the common labels.
   * @default {}
   */
  labels?: JSONObject;
};

export interface PrometheusPluginOptions {
  /**
   * Prepended to the name of the application's custom metrics.
   * @default ""
   */
  prefix?: string;

  /**
   * Label combinations accepted per custom metric.
   * @default 1000
   */
  maxLabelSets?: number;
}

type ResolvedConfiguration = {
  core: Required<NonNullable<PrometheusPluginConfiguration["core"]>>;
  default: Required<NonNullable<PrometheusPluginConfiguration["default"]>>;
  labels: Record<string, string>;
};

/**
 * Gauges updated from the `server:metrics` API action, per component.
 */
type CoreGauges = Record<string, Record<string, client.Gauge<string>>>;

/**
 * Deep-merges `value` over `defaults`; arrays replace the default array.
 */
function merge<T>(defaults: T, value: unknown): T {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof defaults !== "object" ||
    defaults === null ||
    Array.isArray(defaults)
  ) {
    return (value === undefined ? defaults : value) as T;
  }

  const result: Record<string, unknown> = {
    ...(defaults as Record<string, unknown>),
  };
  for (const [key, entry] of Object.entries(value)) {
    result[key] = merge((defaults as Record<string, unknown>)[key], entry);
  }
  return result as T;
}

/**
 * The Kuzzle plugin: Kuzzle metrics, request duration, Node.js metrics, and a
 * `Metrics` instance for the application's own metrics (`plugin.metrics`).
 */
export class PrometheusPlugin extends Plugin {
  public config: ResolvedConfiguration = {
    core: {
      monitorRequestDuration: true,
      prefix: "kuzzle_",
      requestDurationBuckets: DEFAULT_REQUEST_DURATION_BUCKETS,
    },
    default: {
      enabled: true,
      // Standard Node.js dashboards use the unprefixed names
      eventLoopMonitoringPrecision: 10,
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
      prefix: "",
    },
    labels: {},
  };

  /**
   * Declare the application's metrics on it, at startup: they are exposed
   * with the Kuzzle metrics.
   */
  public readonly metrics: Metrics;

  private core: CoreGauges = {};
  private requestDuration?: client.Histogram<string>;

  constructor(options: PrometheusPluginOptions = {}) {
    super({
      kuzzleVersion: ">=2.59.0 <3",
    });

    // Node.js metrics start at init, once their configuration is known
    this.metrics = new Metrics({
      ...options,
      defaultMetrics: { enabled: false },
    });
  }

  async init(
    config: PrometheusPluginConfiguration | undefined,
    context: PluginContext,
  ) {
    this.context = context;

    const merged = merge(this.config, config ?? {});
    this.config = {
      ...merged,
      labels: {
        ...Object.fromEntries(
          Object.entries(merged.labels).map(([name, value]) => [
            name,
            String(value),
          ]),
        ),
        nodeId: context.accessors.nodeId,
      },
    };

    completeConfiguration(this.metrics, {
      defaultMetrics: this.config.default,
      labels: this.config.labels,
      logger: context.log as unknown as MetricsLogger,
    });

    this.declareCoreMetrics();

    this.pipes = {
      "server:afterMetrics": async (request: KuzzleRequest) =>
        this.pipeFormatMetrics(request),
    };

    // The request duration histogram only exists when this option is on
    this.hooks = this.config.core.monitorRequestDuration
      ? {
          "request:onError": this.recordRequest.bind(this),
          "request:onSuccess": this.recordRequest.bind(this),
        }
      : {};

    this.api = {
      prometheus: {
        actions: {
          metrics: {
            handler: (request: KuzzleRequest) => this.serveMetrics(request),
            http: [{ path: "metrics", verb: "get" }],
          },
        },
      },
    };
  }

  /**
   * `server:metrics?format=prometheus` over HTTP: answers with the Prometheus
   * text instead of the JSON result.
   */
  async pipeFormatMetrics(request: KuzzleRequest): Promise<KuzzleRequest> {
    if (
      request.getString("format", "invalid") === "prometheus" &&
      request.context.connection.protocol === "http"
    ) {
      this.updateCoreMetrics(request.response.result as JSONObject);
      await this.respond(request);
    }
    return request;
  }

  /**
   * `GET /_/metrics`, for scrapers that cannot pass a query string.
   */
  async serveMetrics(request: KuzzleRequest): Promise<string | undefined> {
    if (request.context.connection.protocol !== "http") {
      return undefined;
    }

    const { result } = await this.context.accessors.sdk.query({
      action: "metrics",
      controller: "server",
    });
    this.updateCoreMetrics(result);

    return this.respond(request);
  }

  recordRequest(request: KuzzleRequest): void {
    this.requestDuration?.observe(
      {
        // String(): a null value is exported as "null", as prom-client did
        action: String(request.input.action),
        controller: String(request.input.controller),
        protocol: String(request.context.connection.protocol),
        status: request.status,
      },
      Date.now() - request.timestamp,
    );
  }

  private async respond(request: KuzzleRequest): Promise<string> {
    const { contentType, body } = await this.metrics.render();
    request.response.configure({
      format: "raw",
      headers: { "Content-Type": contentType },
    });
    request.response.result = body;
    return body;
  }

  private declareCoreMetrics(): void {
    const registry = registryOf(this.metrics);
    const { prefix } = this.config.core;

    const gauge = (name: string, help: string, labelNames: string[] = []) =>
      new client.Gauge({
        help,
        labelNames,
        name: `${prefix}${name}`,
        registers: [registry],
      });

    this.core = {
      api: {
        concurrentRequests: gauge(
          "api_concurrent_requests",
          "Number of concurrent requests",
        ),
        pendingRequests: gauge(
          "api_pending_requests",
          "Number of pending requests",
        ),
      },
      network: {
        connections: gauge("network_connections", "Number of connections", [
          "protocol",
        ]),
      },
      realtime: {
        rooms: gauge("realtime_rooms", "Number of rooms"),
        subscriptions: gauge(
          "realtime_subscriptions",
          "Number of subscriptions",
        ),
      },
    };

    if (this.config.core.monitorRequestDuration) {
      this.requestDuration = new client.Histogram({
        buckets: this.config.core.requestDurationBuckets,
        help: "Duration of Kuzzle requests in ms",
        labelNames: ["action", "controller", "protocol", "status"],
        name: `${prefix}api_request_duration_ms`,
        registers: [registry],
      });
    }
  }

  /**
   * Sets the Kuzzle gauges from a `server:metrics` result. They are reset
   * first: a protocol without connections disappears.
   */
  private updateCoreMetrics(result: JSONObject): void {
    for (const component of Object.values(this.core)) {
      for (const gauge of Object.values(component)) {
        gauge.reset();
      }
    }

    for (const [component, values] of Object.entries(result ?? {})) {
      for (const [metric, value] of Object.entries(
        (values ?? {}) as JSONObject,
      )) {
        const gauge = this.core[component]?.[metric];
        if (gauge === undefined) {
          continue;
        }

        if (typeof value === "number") {
          gauge.set(value);
        } else if (typeof value === "object" && value !== null) {
          // network.connections, per protocol
          for (const [protocol, count] of Object.entries(value)) {
            gauge.set({ protocol }, count as number);
          }
        }
      }
    }
  }
}
