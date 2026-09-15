import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Does this error look like the browser refusing to store anything?
 *
 * Worth being strict about. The first version of this boundary told every user who hit *any*
 * render error to turn off private browsing — advice that does nothing for a bug that has
 * nothing to do with storage, and that quietly blames the person's browser for our own crash.
 * Anything not on this list is reported as an unknown fault, honestly.
 */
export function isStorageError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const name = error.name
  // Dexie prefixes its own subclasses; the DOM ones come straight from IndexedDB.
  if (/^(SecurityError|QuotaExceededError|InvalidStateError|NotFoundError|VersionError|AbortError|UnknownError|DataError|ConstraintError)$/.test(name)) {
    return true
  }
  if (/^(Dexie|MissingAPI|OpenFailed|Upgrade|VersionChange|DatabaseClosed|InvalidTable)/.test(name)) return true
  return /indexeddb|quota|storage|database|object ?store|transaction/i.test(error.message)
}

interface Props {
  children: ReactNode
  /** Rendered instead of the children once something throws. `reset` retries the subtree. */
  fallback: (info: { error: unknown; storage: boolean; reset: () => void }) => ReactNode
  /** Names the subtree in the console, so a maintainer on the phone knows which part fell over. */
  label: string
}

interface State {
  error: unknown
  failed: boolean
}

/** Catches a render-phase throw in one subtree and hands it to `fallback`. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, failed: false }

  static getDerivedStateFromError(error: unknown): State {
    return { error, failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Sooda has no server to report to, so the console is the only place this can go.
    console.error(`Sooda: ${this.props.label} failed`, error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return this.props.fallback({
      error: this.state.error,
      storage: isStorageError(this.state.error),
      reset: () => this.setState({ error: null, failed: false }),
    })
  }
}
