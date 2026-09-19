import { describe, expect, it } from 'vitest'
import { INSTALLMENT_BASE_FIELDS, resolveDownPayment } from './installmentFields'
import type { FieldSpec, ModeState } from './types'

/*
 * Reported live: tapping the down payment's Amount/Percent toggle left the typed digits exactly
 * as they were while quietly changing what they meant — 2,000,000 (an amount, against a
 * 10,000,000 cash price) read as 2,000,000% the instant Percent was tapped, and Calculate failed
 * on "down payment exceeds the cash price", an error that had nothing to do with anything the
 * shopkeeper had actually done wrong. These tests hold both halves of the fix: the field now
 * shows the unit it is currently being read as, and switching converts the value rather than
 * reinterpreting it.
 */

const downField = INSTALLMENT_BASE_FIELDS.find((f) => f.key === 'down') as FieldSpec
const downModeField = INSTALLMENT_BASE_FIELDS.find((f) => f.key === 'downMode') as FieldSpec

describe('the down payment field knows which unit it is in', () => {
  it('is money by default', () => {
    expect(downField.kindWhen?.({})).toBe('money')
    expect(downField.kindWhen?.({ downMode: 'amount' })).toBe('money')
  })

  it('is percent once its own toggle is switched', () => {
    expect(downField.kindWhen?.({ downMode: 'percent' })).toBe('percent')
  })
})

describe('switching Amount/Percent converts the value instead of reinterpreting it', () => {
  it('amount → percent: 2,000,000 of a 10,000,000 cash price becomes 20', () => {
    const values: ModeState = { cash: '10000000', down: '2000000', downMode: 'amount' }
    const result = downModeField.onToggle?.('percent', values)
    expect(result).toEqual({ key: 'down', value: '20' })
  })

  it('percent → amount: 20% of a 10,000,000 cash price becomes 2,000,000', () => {
    const values: ModeState = { cash: '10000000', down: '20', downMode: 'percent' }
    const result = downModeField.onToggle?.('amount', values)
    expect(result).toEqual({ key: 'down', value: '2000000' })
  })

  it('round-trips: amount → percent → amount returns the original figure', () => {
    const cash = '10000000'
    const toPercent = downModeField.onToggle?.('percent', { cash, down: '3500000', downMode: 'amount' })
    const backToAmount = downModeField.onToggle?.('amount', { cash, down: toPercent?.value ?? '', downMode: 'percent' })
    expect(backToAmount).toEqual({ key: 'down', value: '3500000' })
  })

  it('reads Persian digits and thousands separators the same as plain ASCII ones', () => {
    const values: ModeState = { cash: '۱۰٬۰۰۰۰۰۰', down: '۲٬۰۰۰۰۰۰', downMode: 'amount' }
    expect(downModeField.onToggle?.('percent', values)).toEqual({ key: 'down', value: '20' })
  })

  it('clears rather than guessing when there is no usable cash price to convert against', () => {
    expect(downModeField.onToggle?.('percent', { cash: '', down: '2000000', downMode: 'amount' })).toEqual({
      key: 'down',
      value: '',
    })
    expect(downModeField.onToggle?.('percent', { cash: '0', down: '2000000', downMode: 'amount' })).toEqual({
      key: 'down',
      value: '',
    })
    expect(downModeField.onToggle?.('percent', { cash: 'not a number', down: '2000000', downMode: 'amount' })).toEqual(
      { key: 'down', value: '' },
    )
  })

  it('clears rather than carrying forward a down payment that was never a valid number', () => {
    expect(downModeField.onToggle?.('percent', { cash: '10000000', down: '', downMode: 'amount' })).toEqual({
      key: 'down',
      value: '',
    })
  })
})

describe('resolveDownPayment (the calculation step downstream of the field)', () => {
  it('reads the same 2,000,000 whether entered directly or arrived at via the percent toggle', () => {
    const direct = resolveDownPayment(10_000_000, { down: 2_000_000 }, { downMode: 'amount' })
    const viaToggle = resolveDownPayment(10_000_000, { down: 20 }, { downMode: 'percent' })
    expect(direct).toBe(2_000_000)
    expect(viaToggle).toBe(2_000_000)
  })
})
