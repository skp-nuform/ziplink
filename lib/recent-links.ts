export const recentLinksKey = 'shortly.recent-links.v1';
export const recentLinksLimit = 20;
export type RecentLink = { slug: string; destination: string; title: string; createdAt: number };
export type RecentLinks = { version: 1; links: RecentLink[]; selectedSlug: string | null };
export const emptyRecentLinks = (): RecentLinks => ({ version: 1, links: [], selectedSlug: null });

function safeLink(value: unknown): value is RecentLink {
  if (!value || typeof value !== 'object') return false;
  const link = value as Record<string, unknown>;
  if (typeof link.slug !== 'string' || !/^[a-z0-9][a-z0-9_-]{2,39}$/.test(link.slug)) return false;
  if (typeof link.title !== 'string' || !link.title.trim() || link.title.length > 100) return false;
  if (typeof link.createdAt !== 'number' || !Number.isFinite(link.createdAt) || link.createdAt < 0 || link.createdAt > 8.64e15) return false;
  if (typeof link.destination !== 'string' || link.destination.length > 4096) return false;
  try {
    const url = new URL(link.destination);
    return ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
}

export function readRecentLinks(raw: string | null): RecentLinks {
  if (!raw || raw.length > 150_000) return emptyRecentLinks();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyRecentLinks();
    const source = data as Record<string, unknown>;
    if (source.version !== 1 || !Array.isArray(source.links)) return emptyRecentLinks();
    const seen = new Set<string>();
    const links: RecentLink[] = [];
    for (const item of source.links) {
      if (!safeLink(item) || seen.has(item.slug)) continue;
      seen.add(item.slug);
      // Copy only the fields this device history needs, never credentials or server state.
      links.push({ slug: item.slug, destination: item.destination, title: item.title, createdAt: item.createdAt });
      if (links.length === recentLinksLimit) break;
    }
    const selectedSlug = typeof source.selectedSlug === 'string' && links.some(link => link.slug === source.selectedSlug) ? source.selectedSlug : null;
    return { version: 1, links, selectedSlug };
  } catch { return emptyRecentLinks(); }
}

export function rememberLink(history: RecentLinks, link: RecentLink): RecentLinks {
  return readRecentLinks(JSON.stringify({ version: 1, links: [link, ...history.links.filter(item => item.slug !== link.slug)], selectedSlug: link.slug }));
}

export function forgetLink(history: RecentLinks, slug: string): RecentLinks {
  return { ...history, links: history.links.filter(link => link.slug !== slug), selectedSlug: history.selectedSlug === slug ? null : history.selectedSlug };
}
