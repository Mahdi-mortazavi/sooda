import { describe, expect, it } from 'vitest'
import { LESSONS } from './index'
import { MISSION } from './mission'
import { LESSON_EXPECTED, LESSON_INPUTS } from './expected.generated'
import { PINNED_NOW } from './expected.source'
import { buildSeed } from '../sandbox/seed'
import { computeCheckIn } from '../../lib/checkin'
import { profitMode } from '../../lib/modes/profit'
import { sellMode } from '../../lib/modes/sell'
import { installmentBehaviour } from '../../lib/modes/installment'
import { TUTORIAL_MONTHLY_PERCENT, TUTORIAL_ROUNDING_STEP } from './rate'
import ratesFile from '../../../public/data/rates.json'

const ctx = (state: any = {}) => ({
  monthlyInflationPercent: TUTORIAL_MONTHLY_PERCENT,
  roundingStep: TUTORIAL_ROUNDING_STEP,
  now: PINNED_NOW,
  state,
})

describe('REVIEW', () => {
  it('R1: which rendered (non-task) challenges carry a target', () => {
    const rows: string[] = []
    for (const l of LESSONS) for (const c of l.challenges) {
      if (c.kind === 'task') continue
      rows.push(`${l.id}.${c.id} kind=${c.kind} target=${String((c as any).target)}`)
    }
    console.log('NON-TASK CHALLENGES:\n' + rows.join('\n'))
    const withTarget = rows.filter((r) => !r.endsWith('target=undefined'))
    console.log('with a target:', withTarget.length, 'of', rows.length)
  })

  it('R2: how many products the demo shop offers in a check-in', async () => {
    const seed = buildSeed(PINNED_NOW)
    const byProduct = new Map<number, any[]>()
    for (const o of seed.observations) {
      const list = byProduct.get(o.productId) ?? []
      list.push(o)
      byProduct.set(o.productId, list)
    }
    const source = {
      listProducts: async () => seed.products,
      observationsByProduct: async () => byProduct,
      readStoreProfile: async () => seed.profile,
      hasStoreProfile: async () => true,
    }
    const snap = await computeCheckIn(ratesFile as any, source as any, () => PINNED_NOW)
    console.log('check-in items:', snap.items.length,
      snap.items.map((i) => `${i.product.id}:${i.product.name} predicted=${i.predictedCost}`))
  })

  it('R3: figures the lesson displays vs figures the challenge asks for', () => {
    const p = profitMode.compute({ cost: 150_000, margin: 25 }, ctx())
    console.log('profit step result price =', p.price, ' challenge answer =', LESSON_EXPECTED.profit.sellingPrice)
    const inst = installmentBehaviour.compute({ cash: 12_000_000, n: 6, down: 0 }, ctx())
    console.log('installment step result =', JSON.stringify(inst))
    console.log('installments challenge answer =', LESSON_EXPECTED.installments.monthly, 'tolerance 1000')
    // naive answers a shopkeeper might reach for
    console.log('naive 12,000,000/6 =', 12_000_000 / 6, 'off by', Math.abs(12_000_000/6 - LESSON_EXPECTED.installments.monthly))
  })

  it('R4: everyday combined tolerance edge', () => {
    const rice = profitMode.compute({ cost: 2_480_000, margin: 12 }, ctx())
    const oil = profitMode.compute({ cost: 118_000, margin: 8 }, ctx())
    console.log('rice', rice.price, rice.profitAmount, 'oil', oil.price, oil.profitAmount)
    const exactRice = 2_480_000 * 0.12
    const exactOil = 118_000 * 0.08
    console.log('exact unrounded sum =', exactRice + exactOil, 'answer =', LESSON_EXPECTED.everyday.combinedProfit,
      'gap =', Math.abs(exactRice + exactOil - LESSON_EXPECTED.everyday.combinedProfit), 'tolerance 1000')
  })

  it('R5: realProfit — what the two calculate steps show', () => {
    const nominal = sellMode.compute({ cost: 118_000, price: 128_000 }, ctx())
    console.log('step nominal:', JSON.stringify(nominal.figures ?? nominal))
    const lensed = sellMode.compute({ cost: 118_000, price: 128_000 }, ctx({ months: '3' }))
    console.log('step verdict (estimate):', JSON.stringify(lensed.figures))
    const known = sellMode.compute({ cost: 118_000, price: 128_000 }, ctx({ months: '3', replacementSource: 'known', replacement: '130000' }))
    console.log('step again (known 130k):', JSON.stringify(known.figures))
  })

  it('R6: mission — what the two calculate steps show', () => {
    const before = profitMode.compute({ cost: 100_000, margin: 20 }, ctx())
    console.log('mission step calculate:', before.price, before.profitAmount, JSON.stringify(before.figures))
    const after = profitMode.compute({ cost: 100_000, margin: 20 }, ctx({ months: '3' }))
    console.log('mission step again:', after.price, after.profitAmount, JSON.stringify(after.figures))
  })

  it('R7: reading load of each run, in Persian words', async () => {
    const fa = (await import('../../i18n/sheets/fa.json')).default as any
    const learn = fa.learn
    const words = (s: string) => s.trim().split(/\s+/).length
    for (const l of LESSONS) {
      let w = 0
      for (const s of l.steps) w += words(learn[l.id][s.id])
      console.log(`${l.id}: ${l.steps.length} steps, ${w} words of tooltip, estimate ${l.estimateSeconds}s -> ${(l.estimateSeconds/l.steps.length).toFixed(1)}s/step, ${(w/(l.estimateSeconds/60)).toFixed(0)} wpm required`)
    }
    let mw = 0
    for (const s of MISSION.steps) mw += words(learn.mission[s.id])
    console.log(`mission: ${MISSION.steps.length} steps, ${mw} words of tooltip (+${words(learn.mission.story)} story), estimate ${MISSION.estimateSeconds}s -> ${(MISSION.estimateSeconds/MISSION.steps.length).toFixed(1)}s/step, ${(mw/(MISSION.estimateSeconds/60)).toFixed(0)} wpm required`)
  })
})
