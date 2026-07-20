import { NextRequest, NextResponse } from 'next/server';
import { MCPClient } from '@/lib/mcpClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string; token?: string; apiKey?: string };
    const { url, token, apiKey } = body;

    if (!url || !token) {
      return NextResponse.json(
        { success: false, error: 'URL and token are required' },
        { status: 400 }
      );
    }

    const client = new MCPClient(url, token, apiKey ?? '');
    const result = await client.testConnection();

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      },
      { status: 500 }
    );
  }
}
