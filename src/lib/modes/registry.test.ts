import { describe, expect, it } from 'vitest'
import { MODES, type Mode } from '../calc'
import { INSTALLMENT_COUNTS } from '../installment'
import { INSTALLMENT_BASE_FIELDS } from './installmentFields'
import {
  MODE_REGISTRY,
  SEGMENTS,
  defaultModeOfSegment,
  emptyState,
  emptyStates,
  ensureBehaviour,
  fieldKeysOf,
  isModeId,
  loadedBehaviour,
  modeSpec,
  modesOfSegment,
  perMode,
  runMode,
  segmentIndexOf,
  validateMode,
  visibleFields,
} from './registry'
import type { CalcContext, ModeState, PresentContext } from './types'

const calcCtx = (state: ModeState, over: Partial<CalcContext> = {}): CalcContext => ({
  annualInflationPercent: 40,
  roundingStep: 0,
  now: Date.UTC(2026, 8, 15),
  state,
  ...over,
})

/* A translate stub that echoes the key, so assertions can see which string a mode picked. */
const presentCtx = (over: Partial<PresentContext> = {}): PresentContext => ({
  t: (key) => key,
  lang: 'en',
  unit: 'none',
  fmtMoney: (v) => String(v),
  fmtNumber: (v) => String(v),
  roundingStep: 0,
  key: 'k',
  ...over,
})

describe('the registry covers every mode', () => {
  it('has a spec for each Mode and no extras', () => {
    expect(Object.keys(MODE_REGISTRY).sort()).toEqual([...MODES].sort())
  })

  it('places every mode in a declared segment', () => {
    for (const mode of MODES) expect(SEGMENTS).toContain(modeSpec(mode).segment)
  })

  it('opens each segment on its first registered mode', () => {
    expect(defaultModeOfSegment('profit')).toBe('profit')
    expect(defaultModeOfSegment('sell')).toBe('sell')
    expect(defaultModeOfSegment('discount')).toBe('discount')
  })

  it('groups the instalment modes into the profit segment', () => {
    expect(modesOfSegment('profit')).toEqual(['profit', 'installment', 'rinstallment'])
    expect(modesOfSegment('discount')).toEqual(['discount', 'rdiscount'])
    expect(segmentIndexOf('installment')).toBe(0)
    expect(segmentIndexOf('rdiscount')).toBe(2)
  })

  it('recognises mode ids and rejects anything else', () => {
    expect(isModeId('rinstallment')).toBe(true)
    expect(isModeId('magic')).toBe(false)
    expect(isModeId(undefined)).toBe(false)
  })

  it('builds one entry per mode', () => {
    expect(Object.keys(perMode(() => 0)).sort()).toEqual([...MODES].sort())
    expect(Object.keys(emptyStates()).sort()).toEqual([...MODES].sort())
  })
})

describe('field keys are a published contract', () => {
  /* These strings travel in share links, so renaming one silently breaks every link
   * anyone has saved. Changing this table is a deliberate, breaking act. */
  it('never drift', () => {
    const keys: Record<Mode, string[]> = {
      profit: ['cost', 'margin', 'months', 'src', 'replacement'],
      sell: ['cost', 'price', 'months', 'src', 'replacement'],
      discount: ['price', 'off'],
      rdiscount: ['final', 'off'],
      installment: ['cash', 'n', 'downMode', 'down'],
      rinstallment: ['cash', 'n', 'downMode', 'down', 'flat'],
    }
    for (const mode of MODES) expect(fieldKeysOf(mode)).toEqual(keys[mode])
  })

  it('offers the documented instalment terms as chips', () => {
    const count = INSTALLMENT_BASE_FIELDS.find((f) => f.key === 'n')
    expect(count?.options).toEqual(INSTALLMENT_COUNTS.map(String))
    expect(count?.allowCustom).toBe(true)
  })
})

describe('emptyState', () => {
  it('seeds each field with its default', () => {
    expect(emptyState('profit')).toEqual({ cost: '', margin: '', months: '0', src: 'inflation', replacement: '' })
    expect(emptyState('installment').n).toBe('6')
  })
})

describe('visibleFields', () => {
  it('hides the lens source and amount until the money comes back later', () => {
    const now = { ...emptyState('profit') }
    expect(visibleFields('profit', now).map((f) => f.key)).toEqual(['cost', 'margin', 'months'])
  })

  it('reveals the source toggle once a delay is chosen', () => {
    const later = { ...emptyState('profit'), months: '3' }
    expect(visibleFields('profit', later).map((f) => f.key)).toEqual(['cost', 'margin', 'months', 'src'])
  })

  it('reveals the restock amount only when the user says they know it', () => {
    const known = { ...emptyState('profit'), months: '3', src: 'known' }
    expect(visibleFields('profit', known).map((f) => f.key)).toContain('replacement')
  })
})

describe('validateMode', () => {
  it('reports a missing required field and computes nothing', () => {
    const result = validateMode('profit', { ...emptyState('profit'), cost: '', margin: '20' })
    expect(result.ok).toBe(false)
    expect(result.errors['cost']).toBe('required')
  })

  it('treats a blank optional field as zero rather than an error', () => {
    const state = { ...emptyState('profit'), cost: '100000', margin: '20', months: '3', src: 'known' }
    const result = validateMode('profit', state)
    expect(result.ok).toBe(true)
    expect(result.values['replacement']).toBe(0)
  })

  it('never turns a toggle into a number', () => {
    const state = { ...emptyState('profit'), cost: '100000', margin: '20', months: '3' }
    expect(Object.keys(validateMode('profit', state).values)).not.toContain('src')
  })

  it('skips hidden fields entirely', () => {
    const state = { ...emptyState('profit'), cost: '100000', margin: '20' }
    expect(Object.keys(validateMode('profit', state).values)).toEqual(['cost', 'margin', 'months'])
  })

  it('still enforces the legacy per-field rules', () => {
    expect(validateMode('discount', { price: '100', off: '120' }).errors['off']).toBe('discountRange')
    expect(validateMode('rdiscount', { final: '100', off: '100' }).errors['off']).toBe('reverseDiscountRange')
  })
})

describe('deferred instalment behaviour', () => {
  it('is absent until it is asked for, then cached', async () => {
    const behaviour = await ensureBehaviour('installment')
    expect(loadedBehaviour('installment')).toBe(behaviour)
    expect(await ensureBehaviour('installment')).toBe(behaviour)
  })

  it('applies its cross-field rules once loaded', async () => {
    await ensureBehaviour('installment')
    const tooMuchDown = { ...emptyState('installment'), cash: '1000000', n: '6', down: '1000000' }
    expect(validateMode('installment', tooMuchDown).errors['down']).toBe('downPaymentTooHigh')
    const fractionalTerm = { ...emptyState('installment'), cash: '1000000', n: '6.5' }
    expect(validateMode('installment', fractionalTerm).errors['n']).toBe('installmentCountInvalid')
  })

  it('reads a percentage down payment as money', async () => {
    const behaviour = await ensureBehaviour('installment')
    const state = { ...emptyState('installment'), cash: '10000000', n: '6', downMode: 'percent', down: '20' }
    const { values } = validateMode('installment', state)
    const run = runMode(behaviour, values, calcCtx(state), presentCtx())
    expect(run.snapshot.inputs[2]).toBe(2_000_000)
  })
})

describe('runMode', () => {
  it('leaves profit exactly as it was before the lens when the money comes back now', async () => {
    const state = { ...emptyState('profit'), cost: '100000', margin: '20' }
    const { values } = validateMode('profit', state)
    const { display, snapshot } = runMode(await ensureBehaviour('profit'), values, calcCtx(state), presentCtx())
    expect(display.primaryLabel).toBe('results.sellingPrice')
    expect(display.primaryValue).toBe(120000)
    expect(display.lens).toBeUndefined()
    expect(snapshot.results.slice(0, 2)).toEqual([120000, 20000])
  })

  it('suggests the restock-covering price once the money comes back in three months', async () => {
    const state = { ...emptyState('profit'), cost: '100000', margin: '20', months: '3' }
    const { values } = validateMode('profit', state)
    const { display } = runMode(await ensureBehaviour('profit'), values, calcCtx(state), presentCtx())
    expect(display.primaryLabel).toBe('lens.suggestedPrice')
    expect(display.primaryValue).toBeCloseTo(130530.88, 2)
    expect(display.lens?.nominalPercent).toBe(20)
    expect(display.lens?.realPercent).toBeCloseTo(10.32, 2)
    expect(display.lens?.status).toBe('thin')
    expect(display.lens?.replacement).toBeCloseTo(108775.73, 2)
  })

  it("prefers the user's own restock price over the inflation estimate", async () => {
    const state = { ...emptyState('profit'), cost: '100000', margin: '20', months: '3', src: 'known', replacement: '150000' }
    const { values } = validateMode('profit', state)
    const { display } = runMode(await ensureBehaviour('profit'), values, calcCtx(state), presentCtx())
    expect(display.lens?.replacement).toBe(150000)
    expect(display.primaryValue).toBe(180000)
  })

  it('rounds a suggested price up and keeps the exact one alongside', async () => {
    const state = { ...emptyState('profit'), cost: '100000', margin: '20', months: '3' }
    const { values } = validateMode('profit', state)
    const ctx = calcCtx(state, { roundingStep: 5000 })
    const { display } = runMode(await ensureBehaviour('profit'), values, ctx, presentCtx({ roundingStep: 5000 }))
    expect(display.primaryValue).toBe(135000)
    expect(display.exactPrimary).toBe('lens.exact')
  })

  it('calls a sale losing when the money will not buy the goods back', async () => {
    const state = { ...emptyState('sell'), cost: '100000', price: '105000', months: '6' }
    const { values } = validateMode('sell', state)
    const { display } = runMode(await ensureBehaviour('sell'), values, calcCtx(state), presentCtx())
    expect(display.lens?.status).toBe('losing')
    expect(display.lens?.notice).toBe('lens.losingNotice')
    expect(display.isLoss).toBe(true)
  })

  it('reproduces the briefed instalment plan', async () => {
    const state = { ...emptyState('installment'), cash: '10000000', n: '6' }
    const { values } = validateMode('installment', state)
    const { display } = runMode(await ensureBehaviour('installment'), values, calcCtx(state), presentCtx())
    expect(display.primaryValue).toBeCloseTo(1836418.28, 2)
    expect(display.secondaryValue).toBeCloseTo(11018509.68, 2)
    expect(display.schedule?.count).toBe(6)
  })

  it('judges an existing instalment deal against a cash sale', async () => {
    const state = { ...emptyState('rinstallment'), cash: '10000000', n: '6', flat: '3' }
    const { values } = validateMode('rinstallment', state)
    const { display } = runMode(await ensureBehaviour('rinstallment'), values, calcCtx(state), presentCtx())
    expect(display.primaryValue).toBeCloseTo(7.09, 2)
    expect(display.status).toBe('healthy')
  })
})
