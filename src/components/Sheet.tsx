import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IconClose } from './Icons'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** iOS-style bottom sheet: drag handle, drag-to-dismiss, blurred backdrop. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const reducedMotion = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[3px]"
          />
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            animate={reducedMotion ? { opacity: 1 } : { y: '0%' }}
            exit={reducedMotion ? { opacity: 0 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag={reducedMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.02, bottom: 0.6 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 110 || info.velocity.y > 700) onClose()
            }}
            className="glass-sheet glass-ring fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[86dvh] w-full max-w-[520px] flex-col rounded-t-[28px] outline-none"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div aria-hidden className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 cursor-grab rounded-full bg-black/20 dark:bg-white/25" />
            <SheetHeader title={title} onClose={onClose} />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-3">
      <h2 className="text-[22px] font-bold tracking-tight">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('actions.close')}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/8 text-[var(--text-secondary)] transition-colors hover:bg-black/12 dark:bg-white/12 dark:hover:bg-white/18"
      >
        <IconClose size={18} />
      </button>
    </div>
  )
}
