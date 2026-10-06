import { describe, expect, it } from "vitest";

import * as root from "../../src/index";
import * as kuzzle from "../../src/kuzzle/index";

describe("package entry points", () => {
  it("exposes the common labels from both entry points", () => {
    expect(root.COMMON_LABELS).toEqual(["project", "environment", "service"]);
    expect(kuzzle.COMMON_LABELS).toBe(root.COMMON_LABELS);
  });
});
