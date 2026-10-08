import { KuzzleRequest } from "kuzzle";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PrometheusPlugin,
  type PrometheusPluginConfiguration,
} from "../../../src/kuzzle/index";
import { sample } from "../helpers";

const SERVER_METRICS = {
  api: { concurrentRequests: 2, pendingRequests: 0 },
  network: { connections: { "http/1.1": 1, websocket: 3 } },
  realtime: { rooms: 4, subscriptions: 5 },
};

function contextMock() {
  return {
    accessors: {
      nodeId: "knode-test",
      sdk: { query: vi.fn().mockResolvedValue({ result: SERVER_METRICS }) },
    },
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  };
}

type Context = ReturnType<typeof contextMock>;

async function initPlugin(
  config?: PrometheusPluginConfiguration,
  plugin = new PrometheusPlugin(),
): Promise<{ context: Context; plugin: PrometheusPlugin }> {
  const context = contextMock();

  await plugin.init(config, context as any);
  return { context, plugin };
}

function metricsRequest(protocol: string, format?: string) {
  const request = new KuzzleRequest(
    { action: "metrics", controller: "server", ...(format ? { format } : {}) },
    { protocol },
  );
  request.setResult(structuredClone(SERVER_METRICS));
  return request;
}

beforeAll(() => {
  // KuzzleRequest reads the global kuzzle object to set its response
  Reflect.defineProperty(global, "kuzzle", {
    configurable: true,
    get: () => ({ id: "kuzzle" }),
  });
});

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("init", () => {
  it("merges the configuration over the defaults and adds nodeId", async () => {
    const { plugin } = await initPlugin({
      core: { prefix: "custom_" },
      default: { gcDurationBuckets: [0.5, 3] },
      labels: { environment: "test", replicas: 3 },
    });

    expect(plugin.config).toEqual({
      core: {
        monitorRequestDuration: true,
        prefix: "custom_",
        requestDurationBuckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500],
      },
      default: {
        enabled: true,
        eventLoopMonitoringPrecision: 10,
        gcDurationBuckets: [0.5, 3],
        prefix: "",
      },
      labels: { environment: "test", nodeId: "knode-test", replicas: "3" },
    });
  });

  it("registers the pipe, the hooks and the HTTP route", async () => {
    const { plugin } = await initPlugin();

    expect(plugin.pipes?.["server:afterMetrics"]).toBeTypeOf("function");
    expect(plugin.hooks?.["request:onSuccess"]).toBeTypeOf("function");
    expect(plugin.hooks?.["request:onError"]).toBeTypeOf("function");
    expect(plugin.api?.prometheus.actions.metrics.http).toEqual([
      { path: "metrics", verb: "get" },
    ]);
  });

  it("registers no request hook when request duration monitoring is off", async () => {
    const { plugin } = await initPlugin({
      core: { monitorRequestDuration: false },
    });

    expect(plugin.hooks).toEqual({});
    const { body } = await plugin.metrics.render();
    expect(body).not.toContain("kuzzle_api_request_duration_ms");
  });
});

describe("server:afterMetrics pipe", () => {
  it("answers with the Prometheus text over HTTP when format=prometheus", async () => {
    const { plugin } = await initPlugin({
      default: { enabled: false },
      labels: { environment: "dev", project: "acme" },
    });

    const request = await plugin.pipeFormatMetrics(
      metricsRequest("http", "prometheus"),
    );

    expect(request.response.headers["Content-Type"]).toMatch(/^text\/plain/);
    const lines = (request.response.result as string).split("\n");
    expect(lines).toContain(
      'kuzzle_network_connections{protocol="http/1.1",environment="dev",project="acme",nodeId="knode-test"} 1',
    );
    expect(lines).toContain(
      'kuzzle_network_connections{protocol="websocket",environment="dev",project="acme",nodeId="knode-test"} 3',
    );
    expect(lines).toContain(
      'kuzzle_api_concurrent_requests{environment="dev",project="acme",nodeId="knode-test"} 2',
    );
    expect(lines).toContain(
      'kuzzle_realtime_subscriptions{environment="dev",project="acme",nodeId="knode-test"} 5',
    );
  });

  it.each([
    ["http", undefined],
    ["http", "whatEver"],
    ["websocket", "prometheus"],
  ])(
    "leaves the JSON result over %s with format=%s",
    async (protocol, format) => {
      const { plugin } = await initPlugin();

      const request = await plugin.pipeFormatMetrics(
        metricsRequest(protocol, format),
      );

      expect(request.response.result).toEqual(SERVER_METRICS);
    },
  );

  it("drops a protocol that has no connection left", async () => {
    const { plugin } = await initPlugin({ default: { enabled: false } });
    await plugin.pipeFormatMetrics(metricsRequest("http", "prometheus"));

    const next = metricsRequest("http", "prometheus");
    next.setResult({
      ...SERVER_METRICS,
      network: { connections: { "http/1.1": 1 } },
    });
    const request = await plugin.pipeFormatMetrics(next);

    expect(request.response.result).not.toContain('protocol="websocket"');
  });
});

describe("prometheus:metrics route", () => {
  it("queries server:metrics and answers with the Prometheus text", async () => {
    const { context, plugin } = await initPlugin({
      default: { enabled: false },
    });
    const request = new KuzzleRequest(
      { action: "metrics", controller: "prometheus" },
      { protocol: "http" },
    );

    const body = await plugin.serveMetrics(request);

    expect(context.accessors.sdk.query).toHaveBeenCalledWith({
      action: "metrics",
      controller: "server",
    });
    expect(body).toContain('kuzzle_realtime_rooms{nodeId="knode-test"} 4');
    expect(request.response.headers["Content-Type"]).toMatch(/^text\/plain/);
  });

  it("answers nothing outside HTTP", async () => {
    const { context, plugin } = await initPlugin();
    const request = new KuzzleRequest(
      { action: "metrics", controller: "prometheus" },
      { protocol: "websocket" },
    );

    expect(await plugin.serveMetrics(request)).toBeUndefined();
    expect(context.accessors.sdk.query).not.toHaveBeenCalled();
  });
});

describe("request duration", () => {
  function finishedRequest(status: number) {
    const request = new KuzzleRequest(
      { action: "info", controller: "server" },
      { protocol: "http" },
    );
    request.setResult({}, { status });
    return request;
  }

  it("observes each request in the histogram, in milliseconds", async () => {
    const { plugin } = await initPlugin({ default: { enabled: false } });

    plugin.recordRequest(finishedRequest(200));

    const { body } = await plugin.metrics.render();
    const labels = {
      action: "info",
      controller: "server",
      nodeId: "knode-test",
      protocol: "http",
      status: "200",
    };
    expect(sample(body, "kuzzle_api_request_duration_ms_count", labels)).toBe(
      1,
    );
    expect(
      sample(body, "kuzzle_api_request_duration_ms_bucket", {
        ...labels,
        le: "500",
      }),
    ).toBe(1);
  });

  it("uses the configured buckets", async () => {
    const { plugin } = await initPlugin({
      core: { requestDurationBuckets: [10, 1000] },
      default: { enabled: false },
    });

    plugin.recordRequest(finishedRequest(200));

    const { body } = await plugin.metrics.render();
    expect(body).toContain('kuzzle_api_request_duration_ms_bucket{le="1000"');
    expect(body).not.toContain(
      'kuzzle_api_request_duration_ms_bucket{le="500"',
    );
  });
});

describe("application metrics", () => {
  it("exposes the application's metrics with the Kuzzle ones", async () => {
    const plugin = new PrometheusPlugin({ prefix: "iot_" });
    const received = plugin.metrics.counter({
      help: "Payloads received",
      labelNames: ["protocol"],
      name: "payloads_received_total",
    });
    await initPlugin(
      { default: { enabled: false }, labels: { project: "acme" } },
      plugin,
    );

    received.inc({ protocol: "mqtt" });
    const request = await plugin.pipeFormatMetrics(
      metricsRequest("http", "prometheus"),
    );

    expect(request.response.result).toContain(
      'iot_payloads_received_total{protocol="mqtt",project="acme",nodeId="knode-test"} 1',
    );
  });

  it("collects the Node.js metrics with the node labels", async () => {
    const { plugin } = await initPlugin({ labels: { project: "acme" } });

    const { body } = await plugin.metrics.render();
    expect(body).toMatch(
      /^process_cpu_user_seconds_total\{project="acme",nodeId="knode-test"\} /m,
    );
  });

  it("logs cardinality warnings through Kuzzle", async () => {
    const plugin = new PrometheusPlugin({ maxLabelSets: 1 });
    const errors = plugin.metrics.counter({
      help: "h",
      labelNames: ["device"],
      name: "errors_total",
    });
    const { context } = await initPlugin(
      { default: { enabled: false } },
      plugin,
    );

    errors.inc({ device: "a" });
    errors.inc({ device: "b" });

    expect(context.log.warn).toHaveBeenCalledOnce();
  });
});
