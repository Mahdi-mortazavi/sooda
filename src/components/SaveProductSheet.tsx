import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/sheets'
import { vibrate } from '../lib/haptics'
import { formatNumber, type AppLanguage } from '../lib/numbers'
import { emitTour } from '../learn/coach/events'
import { useRepository } from '../learn/ui/useRepository'
import { formatAmountWithUnit, type Unit } from '../lib/units'
import { IconBookmarkPlus } from './Icons'
import { Sheet } from './Sheet'

export interface ProductDraft {
  cost: number
  targetMarginPercent: number
  price: number
  unit: Unit
}

interface SaveProductSheetProps {
  open: boolean
  onClose: () => void
  draft: ProductDraft | null
  lang: AppLanguage
  /** Called after the row is written; the caller shows the toast. */
  onSaved: (name: string) => void
}

/** Compact sheet that names the calculation being saved as a product; every other value comes from the draft. */
export function SaveProductSheet({ open, onClose, draft, lang, onSaved }: SaveProductSheetProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  /* Never `lib/products`' bound exports: during a lesson this is the practice shop's repository,
   * and `persist` is a no-op so the tutorial cannot trip the browser's storage prompt. */
  const { repository, persist } = useRepository()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // The sheet focuses its own panel on open, so the field is claimed one tick later.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(timer)
  }, [open])

  const canSave = name.trim() !== '' && draft !== null && !saving

  const onSave = async () => {
    if (!canSave || !draft) return
    setSaving(true)
    const trimmed = name.trim()
    try {
      // Best-effort: a browser that refuses persistence must not fail the save.
      await persist()
      await repository.addProduct({
        name: trimmed,
        cost: draft.cost,
        targetMarginPercent: draft.targetMarginPercent,
        price: draft.price,
        unit: draft.unit,
        costUpdatedAt: Date.now(),
      })
      vibrate()
      emitTour({ type: 'action', name: 'save-product' })
      setName('')
      onSaved(trimmed)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const pct = t('fields.percentUnit')

  return (
    <Sheet open={open} onClose={onClose} title={t('products.saveTitle')}>
      <div data-tour="save-product-panel">
      <div className="glass glass-ring rounded-3xl px-5 py-3.5">
        <label htmlFor="save-product-name" className="block text-[13px] font-semibold tracking-wide text-[var(--text-secondary)]">
          {t('products.name')}
        </label>
        <input
          ref={inputRef}
          id="save-product-name"
          data-tour="field-product-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            emitTour({ type: 'field:change', field: 'product-name', value: e.target.value })
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void onSave()
            }
          }}
          placeholder={t('products.namePlaceholder')}
          enterKeyHint="done"
          autoComplete="off"
          className="mt-0.5 w-full min-w-0 bg-transparent text-[20px] font-semibold tracking-tight text-[var(--text-primary)] outline-none placeholder:font-medium"
        />
      </div>

      {draft ? (
        <div className="glass glass-ring mt-3 rounded-3xl">
          <DraftRow label={t('fields.purchasePrice')} value={formatAmountWithUnit(draft.cost, lang, draft.unit)} />
          <div aria-hidden className="mx-5 border-t border-[var(--separator)]" />
          <DraftRow label={t('products.targetMargin')} value={`${formatNumber(draft.targetMarginPercent, lang)}${pct}`} />
          <div aria-hidden className="mx-5 border-t border-[var(--separator)]" />
          <DraftRow label={t('fields.sellingPrice')} value={formatAmountWithUnit(draft.price, lang, draft.unit)} />
        </div>
      ) : null}

      <motion.button
        type="button"
        data-tour="btn-save-confirm"
        onClick={() => void onSave()}
        disabled={!canSave}
        whileTap={reducedMotion || !canSave ? undefined : { scale: 0.96 }}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-fill-strong)] px-4 py-3.5 text-[16px] font-bold text-white disabled:opacity-40 dark:text-[hsl(168_90%_8%)]"
      >
        <IconBookmarkPlus size={18} />
        {t('products.save')}
      </motion.button>
      </div>
    </Sheet>
  )
}

function DraftRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-5 py-3">
      <span className="text-[14px] text-[var(--text-secondary)]">{label}</span>
      <span className="text-[15px] font-semibold tabular-nums">{value}</span>
    </div>
  )
}
