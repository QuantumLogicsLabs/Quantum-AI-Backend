import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';

export type SearchSource = 'google' | 'youtube' | 'reddit';

export interface SearchHit {
  source: SearchSource;
  title: string;
  url: string;
  snippet: string;
  meta?: string;
}

export interface WebSearchResult {
  query: string;
  results: SearchHit[];
}

type SerpOrganic = {
  title?: string;
  link?: string;
  snippet?: string;
  date?: string;
};

type SerpVideo = {
  title?: string;
  link?: string;
  channel?: string;
  published_date?: string;
  description?: string;
  length?: string;
};

async function serpFetch(params: Record<string, string>): Promise<Record<string, unknown>> {
  const apiKey = config.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      503,
      'Live web search is not configured. Set SERPAPI_API_KEY on the QuantumAI backend.',
      'SEARCH_NOT_CONFIGURED'
    );
  }

  const url = new URL('https://serpapi.com/search.json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('api_key', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AppError(
      502,
      `Web search failed (${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
      'SEARCH_PROVIDER_ERROR'
    );
  }
  return (await response.json()) as Record<string, unknown>;
}

function mapOrganic(source: SearchSource, items: SerpOrganic[] | undefined, limit: number): SearchHit[] {
  if (!items?.length) return [];
  return items
    .filter((item) => item.title && item.link)
    .slice(0, limit)
    .map((item) => ({
      source,
      title: String(item.title),
      url: String(item.link),
      snippet: String(item.snippet ?? ''),
      meta: item.date ? String(item.date) : undefined,
    }));
}

function mapVideos(items: SerpVideo[] | undefined, limit: number): SearchHit[] {
  if (!items?.length) return [];
  return items
    .filter((item) => item.title && item.link)
    .slice(0, limit)
    .map((item) => ({
      source: 'youtube' as const,
      title: String(item.title),
      url: String(item.link),
      snippet: String(item.description ?? ''),
      meta: [item.channel, item.published_date, item.length].filter(Boolean).join(' · ') || undefined,
    }));
}

export class WebSearchService {
  async search(
    query: string,
    sources: SearchSource[] = ['google', 'youtube', 'reddit'],
    perSource = 5
  ): Promise<WebSearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new AppError(400, 'Search query is required', 'VALIDATION_ERROR');
    }

    const uniqueSources = [...new Set(sources)];
    const tasks = uniqueSources.map(async (source) => {
      if (source === 'google') {
        const data = await serpFetch({ engine: 'google', q: trimmed, num: String(perSource) });
        return mapOrganic('google', data.organic_results as SerpOrganic[] | undefined, perSource);
      }
      if (source === 'youtube') {
        const data = await serpFetch({ engine: 'youtube', search_query: trimmed });
        return mapVideos(data.video_results as SerpVideo[] | undefined, perSource);
      }
      const data = await serpFetch({
        engine: 'google',
        q: `site:reddit.com ${trimmed}`,
        num: String(perSource),
      });
      return mapOrganic('reddit', data.organic_results as SerpOrganic[] | undefined, perSource);
    });

    const settled = await Promise.allSettled(tasks);
    const results: SearchHit[] = [];
    const errors: string[] = [];

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      } else {
        const message =
          outcome.reason instanceof Error ? outcome.reason.message : 'Search source failed';
        errors.push(message);
        if (outcome.reason instanceof AppError && outcome.reason.code === 'SEARCH_NOT_CONFIGURED') {
          throw outcome.reason;
        }
      }
    }

    if (!results.length && errors.length) {
      throw new AppError(502, errors[0] ?? 'Web search failed', 'SEARCH_PROVIDER_ERROR');
    }

    return { query: trimmed, results };
  }

  formatForContext(result: WebSearchResult): string {
    if (!result.results.length) return 'No live web results were found for this query.';
    return result.results
      .map(
        (hit, index) =>
          `[${index + 1}] (${hit.source.toUpperCase()}) ${hit.title}\nURL: ${hit.url}\n${hit.snippet}${
            hit.meta ? `\nMeta: ${hit.meta}` : ''
          }`
      )
      .join('\n\n');
  }
}

export const webSearchService = new WebSearchService();
