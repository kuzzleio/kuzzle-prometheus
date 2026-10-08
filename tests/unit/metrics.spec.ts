import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createMetrics, type MetricsOptions } from "../../src/index";

function quiet(options: MetricsOptions = {}) {
  return createMetrics({
    defaultMetrics: { enabled: false },
    logger: { warn: vi.fn() },
    ...options,
  });
}

async function body(metrics: ReturnType<typeof createMetrics>) {
  return (await metrics.render()).body;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("common labels", () => {
  it("adds project, environment and service to every metric", async () => {
    const metrics = quiet({
      environment: "production",
      project: "acme",
      service: "gateway",
    });
    metrics.counter({ help: "h", name: "events_total" }).inc();

    expect(await body(metrics)).toContain(
      'events_total{project="acme",environment="production",service="gateway"} 1',
    );
  });

  it("reads them from the environment, options winning", async () => {
    vi.stubEnv("KUZZLE_PROMETHEUS_PROJECT", "from-env");
    vi.stubEnv("KUZZLE_PROMETHEUS_ENVIRONMENT", "staging");
    vi.stubEnv("KUZZLE_PROMETHEUS_SERVICE", "env-service");

    const metrics = quiet({ service: "gateway" });
    metrics.counter({ help: "h", name: "events_total" }).inc();

    expect(await body(metrics)).toContain(
      'events_total{project="from-env",environment="staging",service="gateway"} 1',
    );
  });

  it("leaves out a label without value", async () => {
    vi.stubEnv("KUZZLE_PROMETHEUS_PROJECT", "");
    vi.stubEnv("KUZZLE_PROMETHEUS_ENVIRONMENT", "");
    vi.stubEnv("KUZZLE_PROMETHEUS_SERVICE", "");

    const metrics = quiet({ service: "gateway" });
    metrics.counter({ help: "h", name: "events_total" }).inc();

    expect(await body(metrics)).toContain('events_total{service="gateway"} 1');
  });

  it("applies to the Node.js default metrics", async () => {
    const metrics = createMetrics({ service: "gateway" });

    expect(await body(metrics)).toMatch(
      /^process_cpu_user_seconds_total\{service="gateway"\} /m,
    );
  });
});

describe("counter", () => {
  it("increments by 1 or by the given value, per label set", async () => {
    const metrics = quiet({ prefix: "gw_" });
    const received = metrics.counter({
      help: "Messages received",
      labelNames: ["protocol"],
      name: "messages_received_total",
    });

    received.inc({ protocol: "mqtt" });
    received.inc({ protocol: "mqtt" }, 2);
    received.inc({ protocol: "http" });

    const text = await body(metrics);
    expect(text).toContain(
      "# HELP gw_messages_received_total Messages received",
    );
    expect(text).toContain("# TYPE gw_messages_received_total counter");
    expect(text).toContain('gw_messages_received_total{protocol="mqtt"} 3');
    expect(text).toContain('gw_messages_received_total{protocol="http"} 1');
  });

  it("types its labels", () => {
    const metrics = quiet();
    const withLabels = metrics.counter({
      help: "h",
      labelNames: ["protocol"],
      name: "a_total",
    });
    const withoutLabels = metrics.counter({ help: "h", name: "b_total" });

    // @ts-expect-error unknown label
    expect(() => withLabels.inc({ proto: "mqtt" })).toThrow();
    // @ts-expect-error labels argument required
    expect(() => withLabels.inc()).toThrow();
    withoutLabels.inc(2);
    // @ts-expect-error no labels on this metric
    expect(() => withoutLabels.inc({ protocol: "mqtt" })).toThrow();
  });
});

describe("gauge", () => {
  it("sets, increments and decrements", async () => {
    const metrics = quiet();
    const queue = metrics.gauge({ help: "h", name: "queue_size" });
    const connections = metrics.gauge({
      help: "h",
      labelNames: ["protocol"],
      name: "connections",
    });

    queue.set(10);
    queue.inc();
    queue.dec(3);
    connections.set({ protocol: "mqtt" }, 5);
    connections.inc({ protocol: "mqtt" });

    const text = await body(metrics);
    expect(text).toMatch(/^queue_size 8$/m);
    expect(text).toContain('connections{protocol="mqtt"} 6');
  });

  it("sets its value at every scrape with collect", async () => {
    const metrics = quiet();
    let connected = true;
    metrics.gauge({
      collect: (gauge) => gauge.set(connected ? 1 : 0),
      help: "h",
      name: "broker_connected",
    });
    metrics.gauge({
      collect: async (gauge) => {
        await Promise.resolve();
        gauge.set({ protocol: "tcp" }, connected ? 1 : 0);
      },
      help: "h",
      labelNames: ["protocol"],
      name: "adapter_ready",
    });

    expect(await body(metrics)).toMatch(/^broker_connected 1$/m);
    connected = false;
    const text = await body(metrics);
    expect(text).toMatch(/^broker_connected 0$/m);
    expect(text).toContain('adapter_ready{protocol="tcp"} 0');
  });

  it("logs a failing collect and keeps rendering", async () => {
    const warn = vi.fn();
    const metrics = quiet({ logger: { warn } });
    const ready = metrics.gauge({
      collect: () => {
        throw new Error("broker unreachable");
      },
      help: "h",
      name: "ready",
    });
    ready.set(1);
    metrics.counter({ help: "h", name: "events_total" }).inc();

    const text = await body(metrics);
    expect(text).toMatch(/^ready 1$/m);
    expect(text).toMatch(/^events_total 1$/m);
    expect(warn).toHaveBeenCalledWith(
      'Cannot collect gauge "ready": Error: broker unreachable',
    );
  });
});

describe("histogram", () => {
  it("observes values into the given buckets", async () => {
    const metrics = quiet();
    const duration = metrics.histogram({
      buckets: [0.1, 1],
      help: "h",
      labelNames: ["protocol"],
      name: "decode_duration_seconds",
    });

    duration.observe({ protocol: "mqtt" }, 0.05);
    duration.observe({ protocol: "mqtt" }, 0.5);

    const text = await body(metrics);
    expect(text).toContain(
      'decode_duration_seconds_bucket{le="0.1",protocol="mqtt"} 1',
    );
    expect(text).toContain(
      'decode_duration_seconds_bucket{le="1",protocol="mqtt"} 2',
    );
    expect(text).toContain('decode_duration_seconds_count{protocol="mqtt"} 2');
  });

  it("times a block of code in seconds", async () => {
    const metrics = quiet();
    const duration = metrics.histogram({ help: "h", name: "work_seconds" });

    const stop = duration.startTimer();
    const seconds = stop();

    expect(seconds).toBeGreaterThanOrEqual(0);
    expect(seconds).toBeLessThan(1);
    expect(await body(metrics)).toMatch(/^work_seconds_count 1$/m);
  });
});

describe("declaration rules", () => {
  it.each([
    ["counter", "MessagesTotal", /snake_case/],
    ["counter", "messages", /end with "_total"/],
    ["gauge", "queue-size", /snake_case/],
  ] as const)("rejects the %s name %s", (kind, name, error) => {
    const metrics = quiet();
    expect(() => metrics[kind]({ help: "h", name })).toThrow(error);
  });

  it.each(["project", "environment", "service"])(
    "rejects the common label %s in labelNames",
    (label) => {
      const metrics = quiet();
      expect(() =>
        metrics.gauge({ help: "h", labelNames: [label], name: "queue_size" }),
      ).toThrow(/common label/);
    },
  );

  it("rejects invalid, reserved and duplicate labels", () => {
    const metrics = quiet();
    expect(() =>
      metrics.gauge({ help: "h", labelNames: ["Protocol"], name: "a" }),
    ).toThrow(/Invalid label/);
    expect(() =>
      metrics.gauge({ help: "h", labelNames: ["__x"], name: "b" }),
    ).toThrow(/Invalid label/);
    expect(() =>
      metrics.histogram({ help: "h", labelNames: ["le"], name: "c_seconds" }),
    ).toThrow(/reserved/);
    expect(() =>
      metrics.gauge({ help: "h", labelNames: ["a", "a"], name: "d" }),
    ).toThrow(/Duplicate label/);
  });

  it("rejects a metric declared twice", () => {
    const metrics = quiet({ prefix: "gw_" });
    metrics.gauge({ help: "h", name: "queue_size" });

    expect(() => metrics.gauge({ help: "h", name: "queue_size" })).toThrow(
      /"gw_queue_size" is already declared/,
    );
  });

  it("rejects an invalid prefix or maxLabelSets", () => {
    expect(() => quiet({ prefix: "Gateway-" })).toThrow(/Invalid prefix/);
    expect(() => quiet({ maxLabelSets: 0 })).toThrow(/maxLabelSets/);
  });

  it("keeps instances independent", () => {
    quiet().gauge({ help: "h", name: "queue_size" });
    expect(() =>
      quiet().gauge({ help: "h", name: "queue_size" }),
    ).not.toThrow();
  });
});

describe("label sets limit", () => {
  it("drops new combinations past maxLabelSets, warns once and counts the drops", async () => {
    const warn = vi.fn();
    const metrics = quiet({ logger: { warn }, maxLabelSets: 2 });
    const received = metrics.counter({
      help: "h",
      labelNames: ["device"],
      name: "received_total",
    });

    received.inc({ device: "a" });
    received.inc({ device: "b" });
    received.inc({ device: "c" });
    received.inc({ device: "d" });
    received.inc({ device: "a" });

    const text = await body(metrics);
    expect(text).toContain('received_total{device="a"} 2');
    expect(text).toContain('received_total{device="b"} 1');
    expect(text).not.toContain('device="c"');
    expect(text).toContain(
      'kuzzle_prometheus_label_sets_rejected_total{metric="received_total"} 2',
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(
      /"received_total" reached 2 label combinations/,
    );
  });

  it("does not count the label order as a new combination", async () => {
    const metrics = quiet({ maxLabelSets: 1 });
    const errors = metrics.counter({
      help: "h",
      labelNames: ["a", "b"],
      name: "errors_total",
    });

    errors.inc({ a: "1", b: "2" });
    errors.inc({ b: "2", a: "1" });

    expect(await body(metrics)).toContain('errors_total{a="1",b="2"} 2');
  });
});

describe("handler", () => {
  it("serves the metrics over HTTP", async () => {
    const metrics = quiet({ service: "gateway" });
    metrics.counter({ help: "h", name: "events_total" }).inc();

    const server = http.createServer(metrics.handler);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/metrics`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^text\/plain/);
      expect(await response.text()).toContain(
        'events_total{service="gateway"} 1',
      );
    } finally {
      server.close();
    }
  });
});
