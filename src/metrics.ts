import * as client from "@prometheus-io/client";

import { validateDeclaration, validatePrefix, type MetricKind } from "./naming";
import type {
  Counter,
  DefaultMetricsOptions,
  Gauge,
  Histogram,
  HistogramConfiguration,
  MetricConfiguration,
  MetricsHandler,
  MetricsLogger,
  MetricsOptions,
  RenderedMetrics,
} from "./types";

const DEFAULT_MAX_LABEL_SETS = 1000;

const DEFAULT_METRICS: Required<DefaultMetricsOptions> = {
  enabled: true,
  prefix: "",
  eventLoopMonitoringPrecision: 10,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
};

export const REJECTED_METRIC_NAME =
  "kuzzle_prometheus_label_sets_rejected_total";

type Labels = Record<string, string | number>;

/**
 * Keeps one metric under `maxLabelSets` label combinations.
 */
class LabelSetGuard {
  private readonly seen = new Set<string>();
  private warned = false;

  constructor(
    private readonly labelNames: readonly string[],
    private readonly maxLabelSets: number,
    private readonly onReject: (firstTime: boolean) => void,
  ) {}

  /**
   * @returns false when the combination must be dropped
   */
  accept(labels: Labels): boolean {
    if (this.labelNames.length === 0) {
      return true;
    }

    const key = this.labelNames
      .map((name) => String(labels[name]))
      .join("\u0000");
    if (this.seen.has(key)) {
      return true;
    }

    if (this.seen.size >= this.maxLabelSets) {
      this.onReject(!this.warned);
      this.warned = true;
      return false;
    }

    this.seen.add(key);
    return true;
  }
}

/**
 * Splits `(labels?, value?)` arguments according to whether the metric
 * declares labels.
 */
function splitArgs(
  hasLabels: boolean,
  args: unknown[],
): { labels: Labels; value: number | undefined } {
  return hasLabels
    ? { labels: args[0] as Labels, value: args[1] as number | undefined }
    : { labels: {}, value: args[0] as number | undefined };
}

/**
 * The metrics of one application: create it once with `createMetrics()`.
 */
export class Metrics {
  /**
   * Private so that no `@prometheus-io/client` type reaches the public API;
   * the Kuzzle entry point reads it as `metrics["registry"]`.
   */
  private readonly registry = new client.Registry();

  readonly prefix: string;
  readonly maxLabelSets: number;
  readonly commonLabels: Readonly<Record<string, string>>;

  private readonly logger: MetricsLogger;
  private readonly rejected: client.Counter<"metric">;

  constructor(options: MetricsOptions = {}) {
    this.prefix = options.prefix ?? "";
    validatePrefix(this.prefix);

    this.maxLabelSets = options.maxLabelSets ?? DEFAULT_MAX_LABEL_SETS;
    if (!Number.isInteger(this.maxLabelSets) || this.maxLabelSets < 1) {
      throw new Error(
        `Invalid maxLabelSets ${this.maxLabelSets}: a positive integer is expected`,
      );
    }

    this.logger = options.logger ?? console;

    this.commonLabels = resolveCommonLabels(options);
    this.registry.setDefaultLabels(this.commonLabels);

    this.rejected = new client.Counter({
      name: REJECTED_METRIC_NAME,
      help: "Label combinations dropped because a metric reached maxLabelSets",
      labelNames: ["metric"],
      registers: [this.registry],
    });

    const defaults = { ...DEFAULT_METRICS, ...options.defaultMetrics };
    if (defaults.enabled) {
      client.collectDefaultMetrics({
        register: this.registry,
        prefix: defaults.prefix,
        eventLoopMonitoringPrecision: defaults.eventLoopMonitoringPrecision,
        gcDurationBuckets: defaults.gcDurationBuckets,
      });
    }
  }

  counter<const L extends string = never>(
    configuration: MetricConfiguration<L>,
  ): Counter<L> {
    const { metric, guard, hasLabels } = this.declare(
      "counter",
      configuration,
      (common) => new client.Counter(common),
    );

    return {
      inc: (...args: unknown[]) => {
        const { labels, value } = splitArgs(hasLabels, args);
        if (guard.accept(labels)) {
          metric.inc(labels, value ?? 1);
        }
      },
    } as Counter<L>;
  }

  gauge<const L extends string = never>(
    configuration: MetricConfiguration<L>,
  ): Gauge<L> {
    const { metric, guard, hasLabels } = this.declare(
      "gauge",
      configuration,
      (common) => new client.Gauge(common),
    );

    const apply =
      (operation: "set" | "inc" | "dec", fallback?: number) =>
      (...args: unknown[]) => {
        const { labels, value } = splitArgs(hasLabels, args);
        if (guard.accept(labels)) {
          metric[operation](labels, (value ?? fallback) as number);
        }
      };

    return {
      set: apply("set"),
      inc: apply("inc", 1),
      dec: apply("dec", 1),
    } as Gauge<L>;
  }

  histogram<const L extends string = never>(
    configuration: HistogramConfiguration<L>,
  ): Histogram<L> {
    const { metric, guard, hasLabels } = this.declare(
      "histogram",
      configuration,
      (common) =>
        new client.Histogram({
          ...common,
          ...(configuration.buckets ? { buckets: configuration.buckets } : {}),
        }),
    );

    return {
      observe: (...args: unknown[]) => {
        const { labels, value } = hasLabels
          ? { labels: args[0] as Labels, value: args[1] as number }
          : { labels: {}, value: args[0] as number };
        if (guard.accept(labels)) {
          metric.observe(labels, value);
        }
      },
      startTimer: (labels: Labels = {}) => {
        const start = process.hrtime.bigint();
        return () => {
          const seconds = Number(process.hrtime.bigint() - start) / 1e9;
          if (guard.accept(labels)) {
            metric.observe(labels, seconds);
          }
          return seconds;
        };
      },
    } as Histogram<L>;
  }

  /**
   * Every metric of this instance, in the Prometheus text format.
   */
  async render(): Promise<RenderedMetrics> {
    return {
      contentType: this.registry.contentType,
      body: await this.registry.metrics(),
    };
  }

  /**
   * Node.js `http` / Express handler answering with `render()`.
   */
  readonly handler: MetricsHandler = (_request, response) => {
    this.render().then(
      ({ contentType, body }) => {
        response.statusCode = 200;
        response.setHeader("Content-Type", contentType);
        response.end(body);
      },
      (error: unknown) => {
        this.logger.warn(`Cannot render metrics: ${String(error)}`);
        response.statusCode = 500;
        response.end();
      },
    );
  };

  private rejectLabelSet(metric: string, firstTime: boolean): void {
    this.rejected.inc({ metric });
    if (firstTime) {
      this.logger.warn(
        `Metric "${metric}" reached ${this.maxLabelSets} label combinations: new ones are dropped. ` +
          "One of its labels is probably unbounded (an ID, a URL, free text).",
      );
    }
  }

  private declare<M, L extends string>(
    kind: MetricKind,
    { name, help, labelNames = [] }: MetricConfiguration<L>,
    build: (common: {
      name: string;
      help: string;
      labelNames: string[];
      registers: client.Registry[];
    }) => M,
  ): { metric: M; guard: LabelSetGuard; hasLabels: boolean } {
    validateDeclaration(kind, name, labelNames);

    const fullName = `${this.prefix}${name}`;
    if (this.registry.getSingleMetric(fullName)) {
      throw new Error(
        `Metric "${fullName}" is already declared: declare each metric once, at startup`,
      );
    }

    const metric = build({
      name: fullName,
      help,
      labelNames: [...labelNames],
      registers: [this.registry],
    });

    return {
      metric,
      guard: new LabelSetGuard(labelNames, this.maxLabelSets, (firstTime) =>
        this.rejectLabelSet(fullName, firstTime),
      ),
      hasLabels: labelNames.length > 0,
    };
  }
}

function resolveCommonLabels(options: MetricsOptions): Record<string, string> {
  const values: Record<string, string | undefined> = {
    project: options.project ?? process.env.KUZZLE_PROMETHEUS_PROJECT,
    environment:
      options.environment ?? process.env.KUZZLE_PROMETHEUS_ENVIRONMENT,
    service: options.service ?? process.env.KUZZLE_PROMETHEUS_SERVICE,
  };

  const labels: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    if (value) {
      labels[name] = value;
    }
  }
  return labels;
}

/**
 * Creates the metrics of an application. Call it once, at startup, and share
 * the instance.
 */
export function createMetrics(options?: MetricsOptions): Metrics {
  return new Metrics(options);
}
