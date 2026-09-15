// A new service worker takes over with a reload, which throws away anything the
// user had typed but not calculated. Mirroring raw input into localStorage means
// an update (or a crash, or an OS tab eviction) costs the user nothing.

export const DRAFT_STORAGE_KEY = 'sooda:draft'

/** Trailing-edge delay: long enough to coalesce typing, short enough to survive a surprise reload. */
export const DRAFT_WRITE_DELAY_MS = 400

export interface DraftState {
  /** raw per-field input strings, keyed by mode id then field key */
  modes: Record<string, Record<string, string>>
  mode: string
  tab: 'calculator' | 'products'
  lens?: { months: number; source: 'known' | 'inflation'; replacement: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false
  return Object.values(value).every((entry) => typeof entry === 'string')
}

function isModeMap(value: unknown): value is Record<string, Record<string, string>> {
  if (!isRecord(value)) return false
  return Object.values(value).every(isStringMap)
}

type DraftLens = NonNullable<DraftState['lens']>

function parseLens(value: unknown): DraftLens | null {
  if (!isRecord(value)) return null
  const { months, source, replacement } = value
  if (typeof months !== 'number' || !Number.isFinite(months)) return null
  if (source !== 'known' && source !== 'inflation') return null
  if (typeof replacement !== 'string') return null
  return { months, source, replacement }
}

function parseDraft(value: unknown): DraftState | null {
  if (!isRecord(value)) return null
  if (!isModeMap(value.modes)) return null
  if (typeof value.mode !== 'string') return null
  if (value.tab !== 'calculator' && value.tab !== 'products') return null
  const draft: DraftState = { modes: value.modes, mode: value.mode, tab: value.tab }
  if (value.lens !== undefined) {
    const lens = parseLens(value.lens)
    if (lens === null) return null
    draft.lens = lens
  }
  return draft
}

/** Null when absent, unparseable, or structurally wrong — never throws. */
export function readDraft(): DraftState | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (raw === null) return null
    return parseDraft(JSON.parse(raw))
  } catch {
    // unreadable storage or malformed JSON — treat as "no draft"
    return null
  }
}

export function writeDraft(draft: DraftState): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // quota or private mode — a lost draft must never break the app
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // storage unavailable
  }
}

export interface DraftWriter {
  save: (draft: DraftState) => void
  flush: () => void
  cancel: () => void
}

/** Wraps writeDraft on a trailing-edge timer. Returns { save, flush, cancel }. */
export function createDraftWriter(delayMs: number = DRAFT_WRITE_DELAY_MS): DraftWriter {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: DraftState | null = null

  const clearTimer = (): void => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  const flush = (): void => {
    clearTimer()
    if (pending === null) return
    const draft = pending
    pending = null
    writeDraft(draft)
  }

  const save = (draft: DraftState): void => {
    pending = draft
    clearTimer()
    timer = setTimeout(flush, delayMs)
  }

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') flush()
  }
  const onPageHide = (): void => flush()

  // Backgrounding is the last moment we are guaranteed to run, and on iOS it is
  // often the only one — pagehide fires there where unload does not.
  const wired = typeof document !== 'undefined'
  if (wired) {
    document.addEventListener('visibilitychange', onVisibilityChange)
    if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide)
  }

  const cancel = (): void => {
    clearTimer()
    pending = null
    if (wired) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide)
    }
  }

  return { save, flush, cancel }
}
