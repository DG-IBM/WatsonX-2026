import { NextRequest, NextResponse } from 'next/server';
import { MCPClient } from '@/lib/mcpClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      url?: string;
      token?: string;
      query?: string;
      limit?: number;
    };
    const { url, token, query, limit = 10 } = body;

    if (!url || !token) {
      return NextResponse.json({ error: 'URL and token required' }, { status: 400 });
    }

    const client = new MCPClient(url, token);

    if (query) {
      const docs = await client.queryDocuments(query, limit);
      return NextResponse.json({ documents: docs });
    }

    const docs = await client.getAllDocuments();
    return NextResponse.json({ documents: docs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Query failed' },
      { status: 500 }
    );
  }
}
