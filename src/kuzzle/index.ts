/**
 * kuzzle-prometheus/kuzzle: the Kuzzle plugin built on the module.
 * `kuzzle` is an optional peer dependency, needed by this entry point only.
 * Guide: docs/kuzzle.md.
 */
export {
  DEFAULT_REQUEST_DURATION_BUCKETS,
  PrometheusPlugin,
} from "./PrometheusPlugin";
export type {
  PrometheusPluginConfiguration,
  PrometheusPluginOptions,
} from "./PrometheusPlugin";
export * from "../index";
