import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

/**
 * The last resort, around the whole app.
 *
 * Two rules it did not follow before, both of which cost the user the app:
 *
 * 1. It blamed storage for everything. Someone hitting an unrelated bug was told to turn off
 *    private browsing — useless advice, and it pins our crash on their browser. The cause is
 *    now detected, and an unknown fault says so.
 * 2. It was the ONLY boundary, so a Dexie failure inside one feature replaced the entire
 *    screen. The calculator needs no storage at all and must keep working; the narrower
 *    `FeatureBoundary` below is what keeps a storage fault inside the feature that hit it.
 *
 * The copy is hardcoded rather than translated, because i18n itself reads storage and a
 * boundary that depends on the thing that just broke is not a boundary. It is bilingual, since
 * the user may not have reached the language picker.
 */
export function StorageBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      label="the app"
      fallback={({ storage, reset }) => (
        <div role="alert" className="mx-auto max-w-[30rem] px-6 py-12 text-center leading-relaxed">
          <p className="text-[16px] font-semibold" dir="rtl" lang="fa">
            {storage
              ? 'سودا نمی‌تواند روی این مرورگر حافظه بسازد. ماشین‌حساب کار می‌کند، ولی تاریخچه و کالاها ذخیره نمی‌شوند. اگر حالت ناشناس یا مسدودکردن کوکی‌ها روشن است، خاموشش کنید.'
              : 'سودا به مشکل خورد. یک بار دوباره امتحان کنید؛ اگر باز هم تکرار شد، لطفاً به سازنده خبر بدهید.'}
          </p>
          <p className="mt-5 text-[16px] font-semibold" dir="ltr" lang="en">
            {storage
              ? 'Sooda can’t store anything on this browser. The calculator still works, but history and products won’t be saved. If private browsing or “block all cookies” is on, turn it off.'
              : 'Sooda hit a problem. Try once more — and if it keeps happening, please tell the maker.'}
          </p>
          {/* Retry in place; a full reload is the user's own next step if it persists. */}
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-full bg-[var(--accent-fill-strong)] px-6 py-3 text-[15px] font-bold text-white"
          >
            تلاش دوباره · Try again
          </button>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Wraps one storage-dependent feature so its failure stays local. The rest of Sooda — above
 * all the calculator, which touches no database — carries on.
 */
export function FeatureBoundary({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ErrorBoundary
      label={label}
      fallback={({ storage }) => (
        <div
          role="status"
          className="glass glass-ring mx-auto my-4 max-w-[26rem] rounded-2xl px-4 py-5 text-center text-[13.5px] leading-relaxed text-[var(--text-secondary)]"
        >
          {storage
            ? 'این بخش برای کار کردن به حافظهٔ مرورگر نیاز دارد و روی این مرورگر در دسترس نیست. بقیهٔ سودا کار می‌کند.'
            : 'این بخش باز نشد. بقیهٔ سودا کار می‌کند.'}
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
