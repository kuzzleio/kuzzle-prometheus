import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: "node",
          include: ["tests/unit/**/*.spec.ts"],
          name: "unit",
        },
      },
      {
        // Runs against the Docker Compose stack (`docker compose up -d --wait`)
        extends: true,
        test: {
          environment: "node",
          include: ["tests/functional/**/*.spec.ts"],
          name: "functional",
          testTimeout: 10000,
        },
      },
    ],
  },
});
