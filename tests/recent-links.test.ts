import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRecentLinks, readRecentLinks, rememberLink, forgetLink, recentLinksLimit } from '../lib/recent-links.ts';
const link = { slug: 'test', title: 'My link', destination: 'https://example.com/a?x=1#section', createdAt: 1234 };
test('browser history tolerates absent, malformed and future-version data', () => {
  for (const raw of [null, '', '{broken', 'null', '[]', JSON.stringify({version:2,links:[link]}), 'x'.repeat(150001)]) assert.deepEqual(readRecentLinks(raw), emptyRecentLinks());
});
test('history rejects unsafe addresses, malformed slugs and unbounded values', () => {
  const unsafe = [ {...link, destination:'javascript:alert(1)'}, {...link,destination:'https://user:pass@example.com'}, {...link,slug:'../../api'}, {...link,title:'x'.repeat(101)}, {...link,createdAt:9e15}, {...link,destination:'not a URL'} ];
  assert.deepEqual(readRecentLinks(JSON.stringify({version:1,links:unsafe,selectedSlug:'test'})),emptyRecentLinks());
});
test('history restores selected result while dropping unneeded properties', () => {
  const data=readRecentLinks(JSON.stringify({version:1,links:[{...link,token:'not retained'}],selectedSlug:'test'}));
  assert.deepEqual(data,{version:1,links:[link],selectedSlug:'test'});
});
test('history bounds entries, deduplicates and moves recently created links first', () => {
  let history=emptyRecentLinks();
  for(let i=0;i<30;i++) history=rememberLink(history,{...link,slug:'link-'+i});
  assert.equal(history.links.length,recentLinksLimit);
  assert.equal(history.links[0].slug,'link-29');
  history=rememberLink(history,{...link,slug:'link-15',title:'Updated'});
  assert.equal(history.links.length,recentLinksLimit);assert.equal(history.links[0].title,'Updated');
  assert.equal(history.links.filter(l=>l.slug==='link-15').length,1);
});
test('clearing the displayed result preserves history; forgetting removes only its local entry', () => {
  const remembered=rememberLink(emptyRecentLinks(),link);
  const form=readRecentLinks(JSON.stringify({...remembered,selectedSlug:null}));
  assert.deepEqual(form.links,[link]);assert.equal(form.selectedSlug,null);
  assert.deepEqual(forgetLink(remembered,'test'),emptyRecentLinks());
});
