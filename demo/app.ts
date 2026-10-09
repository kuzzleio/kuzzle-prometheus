import { Backend, KuzzleError } from "kuzzle";

import { PrometheusPlugin } from "../src/kuzzle";

const app = new Backend("kuzzle");

const prometheusPlugin = new PrometheusPlugin();

app.plugin.use(prometheusPlugin);

app.controller.register("testing", {
  actions: {
    failure: {
      handler: async () => {
        throw new KuzzleError("A sample 500 error", 500);
      },
    },
  },
});

app
  .start()
  .then(() => {
    app.log.info("Application started");
  })
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console -- Kuzzle failed to start, its logger may not be up
    console.error(error);
    process.exit(1);
  });
