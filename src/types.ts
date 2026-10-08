import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Labels added to every metric. Never declared in `labelNames`.
 */
export const COMMON_LABELS = ["project", "environment", "service"] as const;

export type CommonLabel = (typeof COMMON_LABELS)[number];

/**
 * Receives the module's warnings (`console` by default).
 */
export interface MetricsLogger {
  warn(message: string): void;
}

export interface DefaultMetricsOptions {
  /**
   * Collect Node.js process metrics (CPU, memory, event loop lag, GC).
   * @default true
   */
  enabled?: boolean;

  /**
   * Prefix of the Node.js process metrics: empty so that standard dashboards
   * work.
   * @default ""
   */
  prefix?: string;

  /**
   * Event loop lag sampling, in milliseconds.
   * @default 10
   */
  eventLoopMonitoringPrecision?: number;

  /**
   * Buckets of the GC duration histogram, in seconds.
   * @default [0.001, 0.01, 0.1, 1, 2, 5]
   */
  gcDurationBuckets?: number[];
}

export interface MetricsOptions {
  /**
   * `service` label of every metric.
   * @default process.env.KUZZLE_PROMETHEUS_SERVICE
   */
  service?: string;

  /**
   * `project` label of every metric.
   * @default process.env.KUZZLE_PROMETHEUS_PROJECT
   */
  project?: string;

  /**
   * `environment` label of every metric.
   * @default process.env.KUZZLE_PROMETHEUS_ENVIRONMENT
   */
  environment?: string;

  /**
   * Prepended to the name of every custom metric.
   * @default ""
   */
  prefix?: string;

  /**
   * Label combinations accepted per metric; new ones past it are dropped.
   * @default 1000
   */
  maxLabelSets?: number;

  /**
   * @default console
   */
  logger?: MetricsLogger;

  defaultMetrics?: DefaultMetricsOptions;
}

/**
 * Values of a metric's labels, all required.
 */
export type LabelValues<L extends string> = Record<L, string | number>;

export interface MetricConfiguration<L extends string> {
  /**
   * snake_case, without the instance prefix.
   */
  name: string;
  help: string;
  labelNames?: readonly L[];
}

export interface HistogramConfiguration<
  L extends string,
> extends MetricConfiguration<L> {
  /**
   * Upper bounds of the buckets, in the unit of the metric.
   * @default [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
   */
  buckets?: number[];
}

export interface GaugeConfiguration<
  L extends string,
> extends MetricConfiguration<L> {
  /**
   * Called at every scrape, before rendering: sets the gauge from a current
   * state (a connection, a readiness flag). It may be async. If it throws,
   * the error is logged and the gauge keeps its previous values.
   */
  collect?: (gauge: Gauge<L>) => void | Promise<void>;
}

/**
 * A metric without labels takes no labels argument.
 */
export type Counter<L extends string> = [L] extends [never]
  ? { inc(value?: number): void }
  : { inc(labels: LabelValues<L>, value?: number): void };

export type Gauge<L extends string> = [L] extends [never]
  ? {
      set(value: number): void;
      inc(value?: number): void;
      dec(value?: number): void;
    }
  : {
      set(labels: LabelValues<L>, value: number): void;
      inc(labels: LabelValues<L>, value?: number): void;
      dec(labels: LabelValues<L>, value?: number): void;
    };

/**
 * `startTimer` returns a function that records the elapsed time, in seconds,
 * and returns it.
 */
export type Histogram<L extends string> = [L] extends [never]
  ? {
      observe(value: number): void;
      startTimer(): () => number;
    }
  : {
      observe(labels: LabelValues<L>, value: number): void;
      startTimer(labels: LabelValues<L>): () => number;
    };

export interface RenderedMetrics {
  contentType: string;
  body: string;
}

export type MetricsHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;
