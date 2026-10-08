/**
 * kuzzle-prometheus: framework-agnostic entry point. No dependency on Kuzzle.
 * Guides: docs/getting-started.md, docs/custom-metrics.md.
 */
export { createMetrics, Metrics } from "./metrics";
export { COMMON_LABELS } from "./types";
export type {
  CommonLabel,
  Counter,
  DefaultMetricsOptions,
  Gauge,
  Histogram,
  HistogramConfiguration,
  LabelValues,
  MetricConfiguration,
  MetricsHandler,
  MetricsLogger,
  MetricsOptions,
  RenderedMetrics,
} from "./types";
