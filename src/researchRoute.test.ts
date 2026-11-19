import { describe, expect, it } from 'vitest';
import { lensHref, parseSiteRoute, siteHref } from './researchRoute';
describe('reviewed site routes', () => {
  it('round-trips each public decision lens and canonical eight-digit identity', () => {
    for (const lens of ['where','opportunity','fit','verification'] as const) {
      const href = lensHref(lens,'11560540','영등포구','field');
      expect(siteHref(parseSiteRoute(href))).toBe(href);
      expect(parseSiteRoute(href)).toMatchObject({lens,gu:'영등포구',dong:'11560540',tier:lens==='where'?'field':''});
    }
    expect(lensHref('where','11560540')).toBe('#view=decision&lens=where&dong=11560540');
  });
  it('shares only reviewed monthly categories on surfaces that display the chart', () => {
    const link = siteHref(parseSiteRoute('#view=supply&dong=11440660&permit=hostel'));
    expect(link).toContain('permit=hostel');
    expect(parseSiteRoute(link)).toMatchObject({view:'supply',dong:'11440660',permit:'hostel'});
    expect(siteHref(parseSiteRoute('#view=supply&permit=PRIVATE'))).not.toContain('permit=');
    expect(siteHref(parseSiteRoute('#view=decision&lens=fit&permit=hostel'))).not.toContain('permit=');
  });
  it('preserves legacy metric bookmarks; unrecognised selectors and arbitrary text are not serialized', () => {
    expect(siteHref(parseSiteRoute('#view=map&period=2025_full&layer=2'))).toBe('#view=map&period=2025_full&layer=2');
    expect(siteHref(parseSiteRoute('#view=other&lens=strange&dong=name&gu=PRIVATE&layer=NaN&tier=custom&q=PRIVATE'))).toBe('#view=decision&lens=opportunity');
  });
});
