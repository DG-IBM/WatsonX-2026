import { NextRequest, NextResponse } from 'next/server';

/**
 * Thin proxy for MCP gateway calls.
 *
 * The MCP gateway (servicesessentials.ibm.com) does not send CORS headers,
 * so browser fetch is blocked. Server-side Node.js fetch works fine.
 *
 * The browser POSTs here with:
 *   { url, token, body }
 * and this route forwards to the MCP gateway and returns the response.
 */
export async function POST(request: NextRequest) {
  try {
    const { url, token, body } = await request.json() as {
      url: string;
      token: string;
      body: unknown;
    };

    if (!url || !token || !body) {
      return NextResponse.json({ error: 'url, token and body are required' }, { status: 400 });
    }

    const rawToken = token.replace(/^Bearer\s+/i, '');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    let mcpRes: Response;
    try {
      mcpRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!mcpRes.ok) {
      const text = await mcpRes.text();
      return NextResponse.json({ error: `MCP gateway error ${mcpRes.status}: ${text}` }, { status: 502 });
    }

    // Forward the response body directly — handles both JSON and SSE
    const contentType = mcpRes.headers.get('content-type') ?? 'application/json';

    if (contentType.includes('text/event-stream')) {
      // Consume SSE, extract last data line, return as JSON
      const text = await mcpRes.text();
      const lines = text.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]');
      if (!lines.length) return NextResponse.json({ result: null });
      const last = lines[lines.length - 1].slice('data: '.length);
      return NextResponse.json(JSON.parse(last));
    }

    const json = await mcpRes.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error('[mcp/proxy]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Proxy failed' },
      { status: 500 }
    );
  }
}
