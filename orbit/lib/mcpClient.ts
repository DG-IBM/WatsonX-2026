import type { MCPDocument, MCPSource } from '@/types/orbit';

const documentCache = new Map<string, MCPDocument>();

export class MCPClient {
  private url: string;
  private token: string;
  private apiKey: string;

  constructor(url: string, token: string, apiKey = '') {
    this.url = url.replace(/\/$/, '');
    // Strip leading "Bearer " if user pasted the full header value
    this.token = token.replace(/^Bearer\s+/i, '');
    this.apiKey = apiKey;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.apiKey) h['x-api-key'] = this.apiKey;
    return h;
  }

  private async rpcCall(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      // Streamable HTTP MCP may return text/event-stream (SSE)
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream')) {
        const text = await res.text();
        // Parse the last `data: {...}` line
        const lines = text.split('\n').filter(l => l.startsWith('data: '));
        if (!lines.length) throw new Error('Empty SSE response');
        const last = lines[lines.length - 1].slice('data: '.length);
        const json = JSON.parse(last);
        if (json.error) throw new Error(json.error.message ?? 'MCP RPC error');
        return json.result;
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(json.error.message ?? 'MCP RPC error');
      }
      return json.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  private detectSource(uri: string): string {
    if (uri.startsWith('github://')) return 'GitHub';
    if (uri.startsWith('jira://')) return 'Jira';
    if (uri.startsWith('confluence://')) return 'Confluence';
    if (uri.startsWith('notion://')) return 'Notion';
    if (uri.startsWith('slack://')) return 'Slack';
    return 'Documentation';
  }

  async testConnection(): Promise<{
    success: boolean;
    sources: MCPSource[];
    totalDocuments: number;
    error?: string;
  }> {
    try {
      // Try tools/list first — Context Studio MCP gateway exposes tools, not resources
      let toolCount = 0;
      try {
        const toolResult = await this.rpcCall('tools/list') as {
          tools?: Array<{ name: string }>;
        };
        toolCount = toolResult.tools?.length ?? 0;
      } catch {
        // fallback: try initialize handshake
        await this.rpcCall('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'orbit', version: '1.0.0' },
        });
      }

      // Try resources/list — may return empty on Context Studio but shouldn't throw
      let resources: Array<{ uri: string; name?: string }> = [];
      try {
        const result = await this.rpcCall('resources/list') as {
          resources?: Array<{ uri: string; name?: string }>;
        };
        resources = result.resources ?? [];
      } catch {
        // Context Studio doesn't expose resources — that's fine
      }

      const sourceMap = new Map<string, number>();
      for (const resource of resources) {
        const source = this.detectSource(resource.uri);
        sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
      }

      // If no resources but tools exist, report a single "Context Studio" source
      if (resources.length === 0 && toolCount > 0) {
        sourceMap.set('Context Studio', toolCount);
      }

      const sources: MCPSource[] = Array.from(sourceMap.entries()).map(([name, count]) => ({
        name,
        count,
      }));

      return {
        success: true,
        sources,
        totalDocuments: resources.length > 0 ? resources.length : toolCount,
      };
    } catch (err) {
      return {
        success: false,
        sources: [],
        totalDocuments: 0,
        error: err instanceof Error ? err.message : 'Could not reach MCP server',
      };
    }
  }

  async getAllDocuments(): Promise<MCPDocument[]> {
    const result = await this.rpcCall('resources/list') as {
      resources?: Array<{ uri: string; name?: string; mimeType?: string }>;
    };

    const resources = (result.resources ?? []).slice(0, 50);
    const documents: MCPDocument[] = [];

    for (let i = 0; i < resources.length; i++) {
      const resource = resources[i];

      if (documentCache.has(resource.uri)) {
        documents.push(documentCache.get(resource.uri)!);
        continue;
      }

      try {
        const readResult = await this.rpcCall('resources/read', { uri: resource.uri }) as {
          contents?: Array<{ text?: string; uri?: string }>;
        };

        const text = readResult.contents?.[0]?.text ?? '';
        const doc: MCPDocument = {
          id: resource.uri,
          source: this.detectSource(resource.uri),
          title: resource.name ?? resource.uri.split('/').pop() ?? resource.uri,
          content: text,
          metadata: { uri: resource.uri, mimeType: resource.mimeType ?? 'text/plain' },
        };

        documentCache.set(resource.uri, doc);
        documents.push(doc);

        // Rate limiting
        if (i < resources.length - 1) {
          await new Promise((r) => setTimeout(r, 100));
        }
      } catch {
        // Skip unreadable resources
      }
    }

    return documents;
  }

  async queryDocuments(query: string, limit = 10): Promise<MCPDocument[]> {
    const allDocs = await this.getAllDocuments();
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter(Boolean);

    const scored = allDocs.map((doc) => {
      const haystack = `${doc.title} ${doc.content}`.toLowerCase();
      const score = terms.reduce((acc, term) => {
        const matches = (haystack.match(new RegExp(term, 'g')) ?? []).length;
        return acc + matches;
      }, 0);
      return { doc, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.doc);
  }

  async getDocument(id: string): Promise<MCPDocument | null> {
    if (documentCache.has(id)) return documentCache.get(id)!;

    try {
      const result = await this.rpcCall('resources/read', { uri: id }) as {
        contents?: Array<{ text?: string }>;
      };
      const text = result.contents?.[0]?.text ?? '';
      return {
        id,
        source: this.detectSource(id),
        title: id.split('/').pop() ?? id,
        content: text,
        metadata: { uri: id },
      };
    } catch {
      return null;
    }
  }
}
