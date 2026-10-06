import kuzzle from "eslint-plugin-kuzzle";

export default [
  {
    ignores: ["node_modules/**", "dist/**"],
  },

  ...kuzzle.configs.default,
  ...kuzzle.configs.node,
  ...kuzzle.configs.typescript.map((config) => ({
    ...config,
    files: ["**/*.ts"],
  })),
];
