/**
 * The value of the sample with exactly these labels, whatever their order:
 * Prometheus identifies a series by its label set, not by the label order.
 */
export function sample(
  body: string,
  name: string,
  labels: Record<string, string>,
): number | undefined {
  const expected = Object.entries(labels)
    .map(([key, value]) => `${key}="${value}"`)
    .sort()
    .join(",");

  for (const line of body.split("\n")) {
    const match = /^([a-zA-Z_:][\w:]*)\{(.*)\} (\S+)$/.exec(line);
    if (
      match?.[1] === name &&
      match[2].split(",").sort().join(",") === expected
    ) {
      return Number(match[3]);
    }
  }
  return undefined;
}
