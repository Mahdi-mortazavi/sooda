// Tests for the sanity checks in update.mjs — the part that decides whether a number
// reaches users. Run with node's own test runner, because vitest's include is
// src/**/*.test.ts and importing .mjs from a .ts file would need allowJs.
// Usage: npm run rates:test   (or: node --test scripts/rates/update.test.mjs)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyUpdate, checkCpi, mergeFx, trimFx, checkShape, parseDay } from './update.mjs'

const dates = (series) => series.map(([date]) => date)

const emptyFile = () => ({
  schema: 1,
  updatedAt: null,
  cpi: {
    source: { name: '', url: '' },
    asOf: null,
    overallMonthlyPercent: null,
    categories: {
      food: null, apparel: null, home: null, digital: null,
      beauty: null, health: null, auto: null, stationery: null,
    },
  },
  fx: { source: { name: '', url: '' }, pair: 'USD/IRT', series: [] },
})

test('accepts a plausible new point and keeps the series ascending', () => {
  const result = mergeFx([['2026-09-01', 100000]], [['2026-09-02', 104000]])
  assert.equal(result.ok, true)
  assert.deepEqual(dates(result.series), ['2026-09-01', '2026-09-02'])
  assert.deepEqual(result.added, [['2026-09-02', 104000]])
})

test('accepts a point exactly at the 25% limit but rejects one past it', () => {
  assert.equal(mergeFx([['2026-09-01', 100000]], [['2026-09-02', 125000]]).ok, true)
  const jumped = mergeFx([['2026-09-01', 100000]], [['2026-09-02', 125001]])
  assert.equal(jumped.ok, false)
  assert.match(jumped.errors[0], /over the 25% limit/)
})

test('rejects a crash as well as a spike', () => {
  const crashed = mergeFx([['2026-09-01', 100000]], [['2026-09-02', 70000]])
  assert.equal(crashed.ok, false)
  assert.match(crashed.errors[0], /30\.0% from 2026-09-01/)
})

test('a duplicate date with the same value is accepted as a no-op', () => {
  const result = mergeFx([['2026-09-01', 100000]], [['2026-09-01', 100000]])
  assert.equal(result.ok, true)
  assert.deepEqual(result.added, [])
  assert.deepEqual(result.unchanged, ['2026-09-01'])
  assert.deepEqual(result.series, [['2026-09-01', 100000]])
})

test('a duplicate date with a conflicting value is rejected', () => {
  const result = mergeFx([['2026-09-01', 100000]], [['2026-09-01', 100500]])
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /already stored as 100000 but upstream now says 100500/)
})

test('rejects zero, negative and non-finite rates', () => {
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '100000', null]) {
    const result = mergeFx([['2026-09-01', 100000]], [['2026-09-02', bad]])
    assert.equal(result.ok, false, `expected ${String(bad)} to be rejected`)
    assert.match(result.errors[0], /not a finite number > 0/)
  }
})

test('rejects a date that is not a real calendar day', () => {
  assert.equal(parseDay('2026-02-30'), null)
  assert.equal(parseDay('2026-9-1'), null)
  const result = mergeFx([], [['2026-02-30', 100000]])
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /not a real YYYY-MM-DD day/)
})

test('trims to the last 400 days of the newest point', () => {
  const series = []
  for (let i = 0; i < 500; i += 1) {
    const day = new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10)
    series.push([day, 100000])
  }
  const trimmed = trimFx(series)
  assert.equal(trimmed.length, 400)
  assert.equal(trimmed[trimmed.length - 1][0], series[series.length - 1][0])
  assert.equal(trimmed[0][0], series[100][0])
})

test('the merge trims, and trimming cannot mask a rejection', () => {
  const series = []
  for (let i = 0; i < 400; i += 1) {
    series.push([new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10), 100000])
  }
  // The oldest point would be trimmed away, but the new point still fails its check first.
  const result = mergeFx(series, [['2026-02-05', 900000]])
  assert.equal(result.ok, false)
  const fine = mergeFx(series, [['2026-02-05', 101000]])
  assert.equal(fine.ok, true)
  assert.equal(fine.series.length, 400)
})

test('back-filling a gap is checked against its real neighbour, not the latest close', () => {
  const existing = [['2026-09-01', 100000], ['2026-09-10', 110000]]
  const result = mergeFx(existing, [['2026-09-05', 105000]])
  assert.equal(result.ok, true)
  assert.deepEqual(dates(result.series), ['2026-09-01', '2026-09-05', '2026-09-10'])
})

test('checkCpi accepts the band edges and rejects outside them', () => {
  assert.equal(checkCpi({ overall: -5, food: 30, apparel: 2.9 }).ok, true)
  assert.equal(checkCpi({ overall: null, food: undefined }).ok, true)
  const low = checkCpi({ overall: -5.1 })
  assert.equal(low.ok, false)
  assert.match(low.errors[0], /outside the plausible \[-5, 30\] band/)
  assert.equal(checkCpi({ food: 30.1 }).ok, false)
  assert.equal(checkCpi({ food: Number.NaN }).ok, false)
  assert.equal(checkCpi({ food: '3' }).ok, false)
})

test('applyUpdate rejects an unknown category id rather than dropping it', () => {
  const result = applyUpdate(emptyFile(), { cpi: { categories: { other: 3 } } })
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /'other' is not a CPI category id/)
})

test('applyUpdate rejects an out-of-range CPI figure and writes nothing', () => {
  const before = emptyFile()
  const result = applyUpdate(before, { cpi: { overallMonthlyPercent: 41, asOf: '2026-08' } })
  assert.equal(result.ok, false)
  assert.equal(before.cpi.overallMonthlyPercent, null, 'the input must not be mutated')
})

test('applyUpdate rejects a malformed asOf', () => {
  assert.equal(applyUpdate(emptyFile(), { cpi: { asOf: '2026-8', overallMonthlyPercent: 3 } }).ok, false)
  assert.equal(applyUpdate(emptyFile(), { cpi: { asOf: '2026-08-01', overallMonthlyPercent: 3 } }).ok, false)
})

test('applyUpdate stamps updatedAt only when something actually changed', () => {
  const start = emptyFile()
  const changed = applyUpdate(start, { fx: { points: [['2026-09-15', 1042000]] } }, { today: '2026-09-15' })
  assert.equal(changed.ok, true)
  assert.equal(changed.next.updatedAt, '2026-09-15')
  assert.equal(start.updatedAt, null, 'the input must not be mutated')

  const again = applyUpdate(changed.next, { fx: { points: [['2026-09-15', 1042000]] } }, { today: '2026-09-16' })
  assert.equal(again.ok, true)
  assert.deepEqual(again.changes, [])
  assert.equal(again.next.updatedAt, '2026-09-15', 'a no-op must not churn updatedAt')
})

test('applyUpdate only overwrites a source when one is supplied', () => {
  const withSource = applyUpdate(emptyFile(), {
    fx: { points: [['2026-09-15', 1042000]], source: { name: 'TGJU', url: 'https://www.tgju.org/' } },
  })
  assert.equal(withSource.next.fx.source.name, 'TGJU')
  const without = applyUpdate(withSource.next, { fx: { points: [['2026-09-16', 1050000]] } })
  assert.equal(without.next.fx.source.name, 'TGJU')
})

test('whatever applyUpdate returns passes the shape guard', () => {
  const result = applyUpdate(emptyFile(), {
    fx: { points: [['2026-09-14', 1040000], ['2026-09-15', 1042000]] },
    cpi: { asOf: '2026-08', overallMonthlyPercent: 3.4, categories: { apparel: 2.9 } },
  })
  assert.equal(result.ok, true)
  assert.deepEqual(checkShape(result.next), { ok: true })
})

test('checkShape catches a file that is not schema 1', () => {
  const bad = emptyFile()
  bad.schema = 2
  assert.equal(checkShape(bad).ok, false)
})

test('a back-filled point is checked against the existing point that follows it too', () => {
  // Only the left neighbour being guarded would let this through: the 2026-09-20 point is
  // not new, so the 300% step up to it would never be looked at.
  const existing = [['2026-09-20', 1042000]]
  const result = mergeFx(existing, [['2026-09-19', 231300]])
  assert.equal(result.ok, false)
  assert.match(result.errors[0], /2026-09-20 at 1042000 is 350\.5% from 2026-09-19/)
})

test('an existing pair that already breaks the limit is not re-litigated', () => {
  // Nothing new touches the bad adjacency, so inserting elsewhere still succeeds.
  const existing = [['2026-09-01', 100000], ['2026-09-02', 900000]]
  const result = mergeFx(existing, [['2026-09-05', 950000]])
  assert.equal(result.ok, true)
  assert.deepEqual(dates(result.series), ['2026-09-01', '2026-09-02', '2026-09-05'])
})
