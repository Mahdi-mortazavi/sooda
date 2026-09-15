import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Catches the one class of failure Sooda cannot design around: a browser that refuses to give
 * it a database. Safari with "Block All Cookies", an exhausted quota, a corrupted store, or a
 * rollback to an older build over a newer schema all make Dexie throw — and `useLiveQuery`
 * re-throws during render, which without a boundary unmounts the whole root and leaves a blank
 * white page rather than a degraded one.
 *
 * The message is deliberately hardcoded rather than translated: i18n itself reads storage, and
 * a boundary that depends on the thing that just failed is not a boundary. It is bilingual
 * instead, because the user has not necessarily reached the language picker.
 */
export class StorageBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No reporter to send this to — Sooda has no server — but the console is the one place a
    // maintainer helping a shopkeeper over the phone can actually look.
    console.error('Sooda could not start:', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <div
        role="alert"
        style={{
          maxWidth: '30rem',
          margin: '0 auto',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1.7,
        }}
      >
        <p style={{ fontSize: '1.05rem', fontWeight: 600 }} dir="rtl" lang="fa">
          سودا نمی‌تواند روی این مرورگر حافظه بسازد. اگر حالت ناشناس یا مسدودکردن کوکی‌ها روشن است،
          خاموشش کنید و دوباره باز کنید.
        </p>
        <p style={{ marginTop: '1.25rem', fontSize: '1.05rem', fontWeight: 600 }} dir="ltr" lang="en">
          Sooda can’t open storage on this browser. If private browsing or “block all cookies” is
          on, turn it off and reload.
        </p>
      </div>
    )
  }
}
