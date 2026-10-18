/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createHash } = require('node:crypto');

// Reviewed derivatives of the member-selected, background-cleaned 1star.png–5star.png.
const preferredArtworkHashes = [
  '013caea55d41117662eb55da188811d9bf68024d1dae6f19f54181ac79efcec3',
  '07f3b5a0bfaaa6d7172e6f1fb8d2bace67de0cbd2612dd08f91a259d4330d74d',
  '1cce3e040c5c2be4b5d91263fdd61fa77ae2282a0981e1d7e751fbcb1f9506fa',
  '56552358050d68703845d0e16ccdf0fc6882acf4a0c4c6a71545729ae590b545',
  '22ae808363f02c108dddddc09fc987cda7bcaf049c3500504eb3fb4ba70d66bb',
];

const filename = path.resolve(__dirname, '../../lib/personalRatings.ts');
const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(output, { exports: exportsObject });
const { createPersonalRatingsStore, ratingBadgeStars, ratingBadgeLabel } = exportsObject;
const row = (stars, user_id = 'a', beer_id = 'beer') => ({ stars, user_id, beer_id });

for (let n = 1; n <= 5; n++) {
  test(`exact ${n}-star icon and accessible label`, () => {
    assert.equal(ratingBadgeStars(n), n);
    assert.equal(ratingBadgeLabel(n), `You rated this beer ${n} out of 5 stars`);
    const png = fs.readFileSync(path.resolve(__dirname, `../../public/rating-icons/hhs-rating-${n}-${n === 1 ? 'star' : 'stars'}.png`));
    assert.equal(createHash('sha256').update(png).digest('hex'), preferredArtworkHashes[n - 1]);
    assert.equal(png.readUInt32BE(16), 160);
    assert.equal(png.readUInt32BE(20), 160);
    assert.equal(png[25], 6, 'RGBA transparency');
    assert.ok(png.length < 50_000, 'Do not bundle the multi-megabyte source canvas');
  });
}
test('no badge for unrated, zero, fraction, out-of-range or nonnumeric data; no rounding', () => {
  for (const value of [undefined, null, 0, 1.5, 4.9, 6, -1, NaN, '3']) assert.equal(ratingBadgeStars(value), null);
});
test('one owner-scoped batch; ignores other members and unrated beers', async () => {
  const queries = [];
  const store = createPersonalRatingsStore('a', async id => {
    queries.push(id);
    return [row(2), row(5, 'b', 'other')];
  });
  await store.refresh();
  assert.deepEqual(queries, ['a']);
  assert.equal(store.getSnapshot().get('beer').stars, 2);
  assert.equal(store.getSnapshot().has('other'), false);
  assert.equal(store.getSnapshot().has('unrated'), false);
});
test('refresh replaces changes and removes deleted rows; local save updates immediately', async () => {
  let rows = [row(1)];
  const store = createPersonalRatingsStore('a', async () => rows);
  await store.refresh();
  store.record(row(5));
  assert.equal(store.getSnapshot().get('beer').stars, 5);
  rows = [row(3)];
  await store.refresh();
  assert.equal(store.getSnapshot().get('beer').stars, 3);
  rows = [];
  await store.refresh();
  assert.equal(store.getSnapshot().size, 0);
});
test('late load cannot undo local save or a newer refresh', async () => {
  let resolve;
  const store = createPersonalRatingsStore('a', () => new Promise(done => { resolve = done; }));
  const pending = store.refresh();
  store.record(row(4));
  resolve([row(1)]);
  await pending;
  assert.equal(store.getSnapshot().get('beer').stars, 4);
  const old = store.refresh();
  const oldResolve = resolve;
  const latest = store.refresh();
  resolve([]);
  await latest;
  oldResolve([row(2)]);
  await old;
  assert.equal(store.getSnapshot().size, 0);
});
test('account switch/logout cannot expose prior state or late requests; logged out never queries', async () => {
  let resolve;
  const old = createPersonalRatingsStore('a', () => new Promise(done => { resolve = done; }));
  const pending = old.refresh();
  old.invalidate();
  const next = createPersonalRatingsStore('b', async () => [row(2, 'b')]);
  assert.equal(next.getSnapshot().size, 0);
  await next.refresh();
  next.record(row(5, 'a'));
  resolve([row(5)]);
  await pending;
  assert.equal(old.getSnapshot().size, 0);
  assert.equal(next.getSnapshot().get('beer').stars, 2);
  const loggedOut = createPersonalRatingsStore(null, async () => assert.fail('Logged-out query'));
  await loggedOut.refresh();
  loggedOut.record(row(1));
  assert.equal(loggedOut.getSnapshot().size, 0);
});
test('failed refresh fails closed and subscriptions clean up', async () => {
  const store = createPersonalRatingsStore('a', async () => { throw Error('offline'); });
  let updates = 0;
  const unsubscribe = store.subscribe(() => updates++);
  store.record(row(5));
  await store.refresh();
  assert.equal(store.getSnapshot().size, 0);
  assert.equal(updates, 2);
  unsubscribe();
  store.record(row(3));
  assert.equal(updates, 2);
});
