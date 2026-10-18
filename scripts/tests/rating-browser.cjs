/* eslint-disable @typescript-eslint/no-require-imports */
// Optional browser regression: supply HHS_BROWSER_MODULE, HHS_BROWSER_EXECUTABLE,
// NEXT_PUBLIC_SUPABASE_URL, and HHS_REVIEW_URL. All member/API data stays mocked.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.HHS_BROWSER_MODULE || 'playwright');

async function main() {
  const base = new URL(process.env.HHS_REVIEW_URL || 'http://localhost:3188');
  const endpoint = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const browser = await chromium.launch({ executablePath: process.env.HHS_BROWSER_EXECUTABLE });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-10-18T12:00:00-07:00') });
    const id = '11111111-1111-4111-8111-111111111111';
    const user = { id, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: {}, user_metadata: {} };
    const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: id, exp: 2000000000, aud: 'authenticated' }, {}]
      .map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.');
    const key = `sb-${endpoint.hostname.split('.')[0]}-auth-token`;
    await context.addInitScript(({ key, token, user }) => localStorage.setItem(key, JSON.stringify({
      access_token: token, refresh_token: 'fixture-only', expires_at: 2000000000, token_type: 'bearer', user,
    })), { key, token, user });
    let ratings = [1, 2, 3, 4, 5].map((stars, i) => ({ user_id: id, beer_id: `beer-${i + 1}`, stars }))
      .concat([{ user_id: id, beer_id: 'beer-18', stars: 5 }, { user_id: id, beer_id: 'beer-19', stars: 4 }]);
    const beers = Array.from({ length: 31 }, (_, i) => ({
      id: `beer-${i + 1}`, day_number: i + 1, name: `Fixture Beer ${i + 1}`, brewery: 'Fixture Brewery', style: 'IPA', abv: 5, image_url: null,
    }));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      let body;
      if (url.hostname === endpoint.hostname) {
        if (url.pathname.includes('/auth/v1/user')) body = user;
        else if (url.pathname.includes('/rest/v1/beers')) body = beers;
        else if (url.pathname.includes('/rest/v1/ratings')) body = ratings.filter(r =>
          !url.searchParams.has('beer_id') || url.searchParams.get('beer_id') === `eq.${r.beer_id}`);
        else body = [];
        if ((route.request().headers().accept || '').includes('vnd.pgrst.object') && Array.isArray(body)) body = body[0] || null;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      }
      if (url.pathname.startsWith('/api/')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
          tier: 'hallowed', supported: true, effectivePreference: 'all',
        }) });
      }
      if (url.hostname !== base.hostname) return route.abort();
      return route.continue();
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/beers', base).href, { waitUntil: 'networkidle' });
    for (const width of [320, 390, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      const result = await page.evaluate(() => {
        const images = [...document.querySelectorAll('img[alt^="You rated"]')].filter(el => el.getClientRects().length);
        return {
          width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
          badges: images.map(el => {
            const r = el.getBoundingClientRect();
            const parent = el.closest('.hhs-cal-cell') || el.parentElement.parentElement;
            return { alt: el.alt, width: r.width, height: r.height,
              rightGap: parent.getBoundingClientRect().right - r.right, loaded: el.complete && el.naturalWidth === 160 };
          }),
          today: [...document.querySelectorAll('span')].filter(el => el.textContent === 'TODAY' && el.getClientRects().length).length,
        };
      });
      console.log(JSON.stringify(result));
      assert.equal(result.overflow, false);
      assert.equal(result.badges.length, 5);
      assert.equal(result.today, 1);
      result.badges.forEach((badge, i) => {
        assert.equal(badge.alt, `You rated this beer ${i + 1} out of 5 stars`);
        assert.equal(badge.width, 40);
        assert.equal(badge.height, 40);
        assert.equal(badge.loaded, true);
        assert.ok(badge.rightGap >= 0 && badge.rightGap < 20);
      });
    }
    ratings = [];
    await page.clock.fastForward(30_000);
    await page.waitForTimeout(200);
    assert.equal(await page.locator('img[alt^="You rated"]').count(), 0, 'remote removal refresh');
    assert.deepEqual(errors, []);
    console.log('Browser fixture layout and removal refresh PASS (no real member data or writes)');
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
