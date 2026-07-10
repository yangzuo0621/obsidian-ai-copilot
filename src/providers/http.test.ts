import { describe, expect, it } from "vitest";

import { formatHttpErrorBody, parseHttpResponseBody } from "./http";

describe("provider HTTP helpers", () => {
  it("parses JSON, text, and empty response bodies", async () => {
    await expect(parseHttpResponseBody(new Response('{"ok":true}'))).resolves.toEqual({ ok: true });
    await expect(parseHttpResponseBody(new Response("plain text"))).resolves.toBe("plain text");
    await expect(parseHttpResponseBody(new Response(null))).resolves.toBeNull();
  });

  it("formats structured and unserializable error bodies", () => {
    expect(formatHttpErrorBody({ error: "bad request" })).toBe('{"error":"bad request"}');

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(formatHttpErrorBody(circular)).toBe("Unable to serialize error response.");
  });
});
