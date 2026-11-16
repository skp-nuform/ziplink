// Reserve application routes. Old links with these endings still use /s/.
const reserved = new Set(['api', 'logout', 'login', 's', '_next', 'favicon.svg', 'favicon.ico', 'robots.txt', 'sitemap.xml']);
export function isReservedSlug(slug: string) { return reserved.has(slug); }
export function linkPath(slug: string) { return isReservedSlug(slug) ? '/s/' + slug : '/' + slug; }
