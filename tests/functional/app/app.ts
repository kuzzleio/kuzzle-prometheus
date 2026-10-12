import { Backend, KuzzleError } from "kuzzle";

import { PrometheusPlugin } from "../../../src/kuzzle";

const app = new Backend("kuzzle");

const prometheus = new PrometheusPlugin({ prefix: "app_" });

// An application metric, declared before start as an application would
const failures = prometheus.metrics.counter({
  help: "Calls to testing:failure",
  name: "failures_total",
});

app.plugin.use(prometheus);

app.controller.register("testing", {
  actions: {
    failure: {
      handler: async () => {
        failures.inc();
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
