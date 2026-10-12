import { describe, expect, it } from "vitest";

// Runs against the Docker Compose stack: docker compose up -d --wait
// WebSocket is the Node.js global (Node 22+)
const host = "localhost:7512";

async function scrape(path: string) {
  const response = await fetch(`http://${host}${path}`);
  return {
    body: await response.text(),
    contentType: response.headers.get("content-type"),
    nodeId: response.headers.get("x-kuzzle-node"),
    status: response.status,
  };
}

describe("server:metrics with format=prometheus", () => {
  it("answers with the Kuzzle metrics in the Prometheus text format", async () => {
    const { body, contentType, nodeId } = await scrape(
      "/_metrics?format=prometheus",
    );

    expect(contentType).toMatch(/^text\/plain/);
    expect(body.split("\n")).toContain(
      `kuzzle_network_connections{protocol="http/1.1",environment="dev",project="prometheus-plugin",nodeId="${nodeId}"} 1`,
    );
    expect(body).toMatch(/^kuzzle_api_concurrent_requests\{.*\} 1$/m);
    expect(body).toMatch(/^process_cpu_user_seconds_total\{/m);
  });

  it.each(["/_metrics", "/_metrics?format=whatEver"])(
    "keeps the JSON answer for %s",
    async (path) => {
      const { body, nodeId } = await scrape(path);
      const json = JSON.parse(body);

      expect(json.result.api).toBeTypeOf("object");
      expect(json.node).toBe(nodeId);
    },
  );

  it("keeps the JSON answer over WebSocket", async () => {
    const connection = new WebSocket(`ws://${host}`);

    const message = await new Promise<string>((resolve, reject) => {
      connection.onerror = reject;
      connection.onmessage = (event) => resolve(String(event.data));
      connection.onopen = () =>
        connection.send(
          JSON.stringify({
            action: "metrics",
            controller: "server",
            format: "prometheus",
          }),
        );
    });
    connection.close();

    const json = JSON.parse(message);
    expect(json.result.api).toBeTypeOf("object");
    expect(json.node).toBeTypeOf("string");
  });
});

describe("GET /_/metrics (prometheus:metrics)", () => {
  it("answers with the same metrics", async () => {
    const { body, contentType, status } = await scrape("/_/metrics");

    expect(status).toBe(200);
    expect(contentType).toMatch(/^text\/plain/);
    expect(body).toMatch(/^kuzzle_realtime_rooms\{/m);
  });
});

describe("request duration and application metrics", () => {
  it("counts a failed request and the application's own metric", async () => {
    const failure = await fetch(`http://${host}/_/testing/failure`);
    expect(failure.status).toBe(500);

    const { body } = await scrape("/_metrics?format=prometheus");

    expect(body).toMatch(
      /^kuzzle_api_request_duration_ms_count\{(?=.*controller="testing")(?=.*action="failure")(?=.*status="500").*\} [1-9]\d*$/m,
    );
    expect(body).toMatch(
      /^app_failures_total\{environment="dev",project="prometheus-plugin",nodeId="[^"]+"\} [1-9]\d*$/m,
    );
  });
});
