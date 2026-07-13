export interface HttpTextResponse {
  text: string;
}

export function parseHttpResponseText(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function parseHttpResponseBody(response: Response | HttpTextResponse): Promise<unknown> {
  if (isHttpTextResponse(response)) {
    return parseHttpResponseText(response.text);
  }

  const text = await response.text();
  return parseHttpResponseText(text);
}

function isHttpTextResponse(response: Response | HttpTextResponse): response is HttpTextResponse {
  return typeof response.text === "string";
}

export function formatHttpErrorBody(responseBody: unknown): string {
  if (typeof responseBody === "string") {
    return responseBody;
  }

  try {
    return JSON.stringify(responseBody);
  } catch {
    return "Unable to serialize error response.";
  }
}
