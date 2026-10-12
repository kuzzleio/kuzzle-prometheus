import { COMMON_LABELS, type CommonLabel } from "./types";

const SNAKE_CASE = /^[a-z_][a-z0-9_]*$/;

export type MetricKind = "counter" | "gauge" | "histogram";

/**
 * Throws when a metric declaration breaks the naming rules
 * (docs/custom-metrics.md#naming-rules).
 */
export function validateDeclaration(
  kind: MetricKind,
  name: string,
  labelNames: readonly string[],
): void {
  if (!SNAKE_CASE.test(name)) {
    throw new Error(
      `Invalid metric name "${name}": use snake_case (lowercase letters, digits, "_")`,
    );
  }

  if (kind === "counter" && !name.endsWith("_total")) {
    throw new Error(
      `Invalid counter name "${name}": counters end with "_total"`,
    );
  }

  const seen = new Set<string>();
  for (const label of labelNames) {
    if (!SNAKE_CASE.test(label) || label.startsWith("__")) {
      throw new Error(
        `Invalid label "${label}" on metric "${name}": use snake_case, not starting with "__"`,
      );
    }

    if ((COMMON_LABELS as readonly string[]).includes(label)) {
      throw new Error(
        `Invalid label "${label}" on metric "${name}": "${label as CommonLabel}" is a common label, added to every metric already`,
      );
    }

    if (kind === "histogram" && label === "le") {
      throw new Error(
        `Invalid label "le" on histogram "${name}": reserved for buckets`,
      );
    }

    if (seen.has(label)) {
      throw new Error(`Duplicate label "${label}" on metric "${name}"`);
    }
    seen.add(label);
  }
}

/**
 * Throws when a prefix would produce invalid metric names.
 */
export function validatePrefix(prefix: string): void {
  if (prefix !== "" && !SNAKE_CASE.test(prefix)) {
    throw new Error(
      `Invalid prefix "${prefix}": use snake_case (lowercase letters, digits, "_")`,
    );
  }
}
