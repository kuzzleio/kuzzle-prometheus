/**
 * kuzzle-prometheus: framework-agnostic entry point (registry, default
 * metrics, `/metrics` handler, common labels). No dependency on Kuzzle.
 *
 * Skeleton: the module is extracted from kuzzle-plugin-prometheus in
 * ADR-0002 step 03.
 */
export const COMMON_LABELS = ["project", "environment", "service"] as const;

export type CommonLabel = (typeof COMMON_LABELS)[number];
