/**
 * A tiny in-memory IndexedDB, written only so the sandbox's isolation test can run for real.
 *
 * `db.migration.test.ts` could not execute an upgrade because vitest runs in the `node`
 * environment and adding a fake backend would have meant adding a dependency. The sandbox cannot
 * settle for that: its whole claim is that a practice session writes to `sooda-practice` and never
 * to `sooda`, and the only honest way to prove that is to run both databases and watch every
 * operation. So the backend is written here, in the repository, with no dependency added.
 *
 * It implements exactly the slice of IndexedDB that Dexie 4 asks for, and nothing else:
 *
 *  * `getAll`/`getAllKeys`/`getAllRecords` are deliberately ABSENT. Dexie feature-detects them
 *    (`'getAll' in store`) and falls back to cursors, so every read goes down one code path.
 *  * a transaction commits on a macrotask once no request is outstanding, which is later than a
 *    real browser would commit and therefore never fails a test a browser would pass.
 *  * transactions are not serialised against each other, and secondary-index uniqueness is not
 *    enforced — Sooda declares no unique secondary index and the tests await every call.
 *
 * Nothing here is imported by application code: it is reachable only from `*.test.ts`.
 */

/* ── keys ───────────────────────────────────────────────────────────────── */

/** Every key type Sooda actually stores, plus the arrays Dexie's compound indexes and maxKey use. */
export type FakeKey = number | string | Date | FakeKey[]

function isValidKey(value: unknown): value is FakeKey {
  if (typeof value === 'number') return !Number.isNaN(value)
  if (typeof value === 'string') return true
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  return Array.isArray(value) && value.every(isValidKey)
}

/* The IndexedDB key ordering: number < date < string < array. (Binary keys are left out — Sooda
 * stores none, and a silently wrong ordering would be worse than a missing one.) */
function keyRank(key: FakeKey): number {
  if (Array.isArray(key)) return 3
  if (key instanceof Date) return 1
  if (typeof key === 'string') return 2
  return 0
}

export function compareKeys(a: FakeKey, b: FakeKey): number {
  const ra = keyRank(a)
  const rb = keyRank(b)
  if (ra !== rb) return ra < rb ? -1 : 1
  if (Array.isArray(a) && Array.isArray(b)) {
    const shared = Math.min(a.length, b.length)
    for (let i = 0; i < shared; i++) {
      const cmp = compareKeys(a[i]!, b[i]!)
      if (cmp !== 0) return cmp
    }
    return a.length === b.length ? 0 : a.length < b.length ? -1 : 1
  }
  const av = a instanceof Date ? a.getTime() : (a as number | string)
  const bv = b instanceof Date ? b.getTime() : (b as number | string)
  if (av === bv) return 0
  return (av as number) < (bv as number) ? -1 : 1
}

type KeyPath = string | string[] | null

function valueAtPath(value: unknown, path: string): unknown {
  let current: unknown = value
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/** The key a record carries at `keyPath`, or undefined when any part of it is missing or unusable. */
function extractKey(value: unknown, keyPath: KeyPath): FakeKey | undefined {
  if (keyPath === null) return undefined
  if (Array.isArray(keyPath)) {
    const parts: FakeKey[] = []
    for (const part of keyPath) {
      const found = valueAtPath(value, part)
      if (!isValidKey(found)) return undefined
      parts.push(found)
    }
    return parts
  }
  const found = valueAtPath(value, keyPath)
  return isValidKey(found) ? found : undefined
}

function injectKey(value: unknown, keyPath: string, key: FakeKey): void {
  const parts = keyPath.split('.')
  let target = value as Record<string, unknown>
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    const next = target[part]
    if (typeof next !== 'object' || next === null) target[part] = {}
    target = target[part] as Record<string, unknown>
  }
  target[parts[parts.length - 1]!] = key
}

/* ── key ranges ─────────────────────────────────────────────────────────── */

class FakeKeyRange {
  constructor(
    readonly lower: FakeKey | undefined,
    readonly upper: FakeKey | undefined,
    readonly lowerOpen: boolean,
    readonly upperOpen: boolean,
  ) {}

  includes(key: FakeKey): boolean {
    if (this.lower !== undefined) {
      const cmp = compareKeys(key, this.lower)
      if (cmp < 0 || (cmp === 0 && this.lowerOpen)) return false
    }
    if (this.upper !== undefined) {
      const cmp = compareKeys(key, this.upper)
      if (cmp > 0 || (cmp === 0 && this.upperOpen)) return false
    }
    return true
  }

  static only(value: FakeKey): FakeKeyRange {
    return new FakeKeyRange(value, value, false, false)
  }
  static lowerBound(lower: FakeKey, open = false): FakeKeyRange {
    return new FakeKeyRange(lower, undefined, open, false)
  }
  static upperBound(upper: FakeKey, open = false): FakeKeyRange {
    return new FakeKeyRange(undefined, upper, false, open)
  }
  static bound(lower: FakeKey, upper: FakeKey, lowerOpen = false, upperOpen = false): FakeKeyRange {
    return new FakeKeyRange(lower, upper, lowerOpen, upperOpen)
  }
}

function asRange(query: FakeKey | FakeKeyRange | null | undefined): FakeKeyRange | null {
  if (query === null || query === undefined) return null
  if (query instanceof FakeKeyRange) return query
  return FakeKeyRange.only(query)
}

/* ── stored data ────────────────────────────────────────────────────────── */

interface IndexDefinition {
  name: string
  keyPath: string | string[]
  unique: boolean
  multiEntry: boolean
}

interface StoreRecord {
  key: FakeKey
  value: unknown
}

interface StoreData {
  name: string
  keyPath: KeyPath
  autoIncrement: boolean
  indexes: Map<string, IndexDefinition>
  /** Sorted by key, always — every read walks it in order. */
  records: StoreRecord[]
  keyGenerator: number
}

interface DatabaseData {
  name: string
  version: number
  stores: Map<string, StoreData>
}

/* ── the operation log (what the isolation test actually reads) ─────────── */

/** One thing that happened against one database. Recorded for every database the factory hosts. */
export interface RecordedOperation {
  database: string
  /** '' for whole-database operations (open, deleteDatabase, transaction). */
  store: string
  op: string
  mode?: IDBTransactionMode
}

/* ── events and requests ────────────────────────────────────────────────── */

interface FakeEvent {
  type: string
  target: FakeRequest
  defaultPrevented: boolean
  preventDefault(): void
  stopPropagation(): void
  oldVersion?: number
  newVersion?: number
}

type EventHandler = ((event: FakeEvent) => unknown) | null

function makeEvent(type: string, target: FakeRequest): FakeEvent {
  const event: FakeEvent = {
    type,
    target,
    defaultPrevented: false,
    preventDefault(): void {
      event.defaultPrevented = true
    },
    stopPropagation(): void {},
  }
  return event
}

class FakeRequest {
  result: unknown = undefined
  error: DOMException | null = null
  readyState: 'pending' | 'done' = 'pending'
  onsuccess: EventHandler = null
  onerror: EventHandler = null
  source: unknown = null
  transaction: FakeTransaction | null = null

  fireSuccess(result: unknown): void {
    this.result = result
    this.readyState = 'done'
    this.onsuccess?.(makeEvent('success', this))
  }

  /** Returns whether a handler called preventDefault — an unhandled error aborts the transaction. */
  fireError(error: DOMException): boolean {
    this.error = error
    this.readyState = 'done'
    const event = makeEvent('error', this)
    this.onerror?.(event)
    return event.defaultPrevented
  }
}

class FakeOpenRequest extends FakeRequest {
  onupgradeneeded: EventHandler = null
  onblocked: EventHandler = null
}

function dbError(name: string, message: string): DOMException {
  return new DOMException(message, name)
}

/* ── transactions ───────────────────────────────────────────────────────── */

class FakeTransaction {
  error: DOMException | null = null
  finished = false
  mode: IDBTransactionMode
  oncomplete: (() => void) | null = null
  onerror: EventHandler = null
  onabort: EventHandler = null
  /** Internal hooks the open request uses to follow a versionchange transaction. */
  onCompleteHook: (() => void) | null = null
  onAbortHook: (() => void) | null = null

  private pending = 0
  private commitArmed = false
  /* Dexie's cache middleware listens for complete/abort/error this way rather than through the
   * on* properties, and cancels its listeners with an AbortSignal. */
  private readonly listeners: { type: string; listener: (event: FakeEvent) => void; signal?: AbortSignal }[] = []
  /** Store snapshots taken before the first write, so an abort really does roll back. */
  private readonly rollback = new Map<string, StoreRecord[]>()
  private readonly rollbackCounters = new Map<string, number>()

  constructor(
    readonly connection: FakeDatabase,
    readonly storeNames: string[],
    mode: IDBTransactionMode,
  ) {
    this.mode = mode
    this.armCommit()
  }

  get db(): FakeDatabase {
    return this.connection
  }

  get objectStoreNames(): FakeStringList {
    return new FakeStringList(this.storeNames)
  }

  addEventListener(type: string, listener: (event: FakeEvent) => void, options?: { signal?: AbortSignal }): void {
    this.listeners.push({ type, listener, ...(options?.signal === undefined ? {} : { signal: options.signal }) })
  }

  removeEventListener(type: string, listener: (event: FakeEvent) => void): void {
    const at = this.listeners.findIndex((entry) => entry.type === type && entry.listener === listener)
    if (at >= 0) this.listeners.splice(at, 1)
  }

  private dispatch(type: string): void {
    const event = makeEvent(type, new FakeRequest())
    for (const entry of [...this.listeners]) {
      if (entry.type !== type || entry.signal?.aborted === true) continue
      entry.listener(event)
    }
  }

  objectStore(name: string): FakeObjectStore {
    if (this.finished) throw dbError('TransactionInactiveError', `Transaction for ${name} has finished`)
    if (!this.storeNames.includes(name)) throw dbError('NotFoundError', `${name} is not in this transaction`)
    const data = this.connection.data.stores.get(name)
    if (data === undefined) throw dbError('NotFoundError', `No object store named ${name}`)
    return new FakeObjectStore(this, data)
  }

  /** Called before the first write to a store, so `abort()` can put it back exactly as it was. */
  snapshot(store: StoreData): void {
    if (this.rollback.has(store.name)) return
    this.rollback.set(store.name, store.records.slice())
    this.rollbackCounters.set(store.name, store.keyGenerator)
  }

  record(store: string, op: string): void {
    this.connection.factory.log.push({ database: this.connection.name, store, op, mode: this.mode })
  }

  /** Queues one request's work. Requests run in the order they were made, as IndexedDB promises. */
  run(request: FakeRequest, work: () => unknown): void {
    if (this.finished) throw dbError('TransactionInactiveError', 'The transaction has finished')
    request.transaction = this
    this.pending++
    queueMicrotask(() => {
      this.pending--
      if (this.finished) return
      try {
        const result = work()
        request.fireSuccess(result)
      } catch (err) {
        const error = err instanceof DOMException ? err : dbError('UnknownError', String(err))
        const handled = request.fireError(error)
        if (!handled) {
          this.abort(error)
          return
        }
      }
      this.armCommit()
    })
  }

  commit(): void {
    this.armCommit()
  }

  abort(error?: DOMException): void {
    if (this.finished) return
    this.finished = true
    this.error = error ?? null
    for (const [name, records] of this.rollback) {
      const store = this.connection.data.stores.get(name)
      if (store === undefined) continue
      store.records = records
      store.keyGenerator = this.rollbackCounters.get(name) ?? store.keyGenerator
    }
    if (error !== null && error !== undefined) {
      this.onerror?.(makeEvent('error', new FakeRequest()))
      this.dispatch('error')
    }
    this.onabort?.(makeEvent('abort', new FakeRequest()))
    this.dispatch('abort')
    this.onAbortHook?.()
  }

  /* A real transaction commits as soon as the event loop finds it with nothing outstanding. A
   * macrotask is strictly later than that: every microtask Dexie has queued — and therefore every
   * follow-up request it was going to make — has already run by the time this fires. */
  private armCommit(): void {
    if (this.finished || this.commitArmed) return
    this.commitArmed = true
    setTimeout(() => {
      this.commitArmed = false
      if (this.finished) return
      if (this.pending > 0) {
        this.armCommit()
        return
      }
      this.finished = true
      this.oncomplete?.()
      this.dispatch('complete')
      this.onCompleteHook?.()
    }, 0)
  }
}

/* ── object stores, indexes and cursors ─────────────────────────────────── */

interface SourceEntry {
  key: FakeKey
  primaryKey: FakeKey
  value: unknown
}

function storeEntries(data: StoreData): SourceEntry[] {
  return data.records.map((record) => ({ key: record.key, primaryKey: record.key, value: record.value }))
}

function indexEntries(data: StoreData, def: IndexDefinition): SourceEntry[] {
  const out: SourceEntry[] = []
  for (const record of data.records) {
    const key = extractKey(record.value, def.keyPath)
    if (key === undefined) continue
    if (def.multiEntry && Array.isArray(key)) {
      for (const part of key) out.push({ key: part, primaryKey: record.key, value: record.value })
    } else {
      out.push({ key, primaryKey: record.key, value: record.value })
    }
  }
  out.sort((a, b) => compareKeys(a.key, b.key) || compareKeys(a.primaryKey, b.primaryKey))
  return out
}

/** Keeps the first entry of each index key — what a `…unique` cursor direction is defined to see. */
function uniqueByKey(entries: SourceEntry[]): SourceEntry[] {
  const out: SourceEntry[] = []
  for (const entry of entries) {
    const last = out[out.length - 1]
    if (last !== undefined && compareKeys(last.key, entry.key) === 0) continue
    out.push(entry)
  }
  return out
}

class FakeCursor {
  key: FakeKey | undefined = undefined
  primaryKey: FakeKey | undefined = undefined
  value: unknown = undefined
  private position = -1

  constructor(
    private readonly tx: FakeTransaction,
    private readonly data: StoreData,
    private readonly entries: SourceEntry[],
    private readonly withValues: boolean,
    private readonly request: FakeRequest,
    readonly direction: IDBCursorDirection,
  ) {}

  /** Moves to `position` and returns the cursor, or null once it has run off the end. */
  step(target: number): FakeCursor | null {
    this.position = target
    const entry = this.entries[this.position]
    if (entry === undefined) return null
    this.key = entry.key
    this.primaryKey = entry.primaryKey
    this.value = this.withValues ? structuredClone(entry.value) : undefined
    return this
  }

  start(): FakeCursor | null {
    return this.step(0)
  }

  continue(key?: FakeKey): void {
    this.tx.run(this.request, () => {
      if (key === undefined) return this.step(this.position + 1)
      const forward = this.direction === 'next' || this.direction === 'nextunique'
      for (let i = this.position + 1; i < this.entries.length; i++) {
        const cmp = compareKeys(this.entries[i]!.key, key)
        if (forward ? cmp >= 0 : cmp <= 0) return this.step(i)
      }
      return this.step(this.entries.length)
    })
  }

  continuePrimaryKey(key: FakeKey, primaryKey: FakeKey): void {
    this.tx.run(this.request, () => {
      for (let i = this.position + 1; i < this.entries.length; i++) {
        const entry = this.entries[i]!
        if (compareKeys(entry.key, key) === 0 && compareKeys(entry.primaryKey, primaryKey) >= 0) return this.step(i)
        if (compareKeys(entry.key, key) > 0) return this.step(i)
      }
      return this.step(this.entries.length)
    })
  }

  advance(count: number): void {
    this.tx.run(this.request, () => this.step(this.position + count))
  }

  update(value: unknown): FakeRequest {
    const store = new FakeObjectStore(this.tx, this.data)
    const primaryKey = this.primaryKey
    if (primaryKey === undefined) throw dbError('InvalidStateError', 'Cursor is not positioned')
    return store.put(value, this.data.keyPath === null ? primaryKey : undefined)
  }

  delete(): FakeRequest {
    const store = new FakeObjectStore(this.tx, this.data)
    const primaryKey = this.primaryKey
    if (primaryKey === undefined) throw dbError('InvalidStateError', 'Cursor is not positioned')
    return store.delete(primaryKey)
  }
}

class FakeIndex {
  constructor(
    private readonly tx: FakeTransaction,
    private readonly data: StoreData,
    private readonly def: IndexDefinition,
  ) {}

  get name(): string {
    return this.def.name
  }
  get keyPath(): string | string[] {
    return this.def.keyPath
  }
  get unique(): boolean {
    return this.def.unique
  }
  get multiEntry(): boolean {
    return this.def.multiEntry
  }

  get(query: FakeKey | FakeKeyRange): FakeRequest {
    const request = new FakeRequest()
    this.tx.record(this.data.name, `index.get:${this.def.name}`)
    this.tx.run(request, () => {
      const range = asRange(query)
      const hit = indexEntries(this.data, this.def).find((entry) => range === null || range.includes(entry.key))
      return hit === undefined ? undefined : structuredClone(hit.value)
    })
    return request
  }

  count(query?: FakeKey | FakeKeyRange | null): FakeRequest {
    const request = new FakeRequest()
    this.tx.record(this.data.name, `index.count:${this.def.name}`)
    this.tx.run(request, () => {
      const range = asRange(query)
      return indexEntries(this.data, this.def).filter((entry) => range === null || range.includes(entry.key)).length
    })
    return request
  }

  openCursor(query?: FakeKey | FakeKeyRange | null, direction: IDBCursorDirection = 'next'): FakeRequest {
    this.tx.record(this.data.name, `index.openCursor:${this.def.name}`)
    return openCursorOn(this.tx, this.data, indexEntries(this.data, this.def), query, direction, true)
  }

  openKeyCursor(query?: FakeKey | FakeKeyRange | null, direction: IDBCursorDirection = 'next'): FakeRequest {
    this.tx.record(this.data.name, `index.openKeyCursor:${this.def.name}`)
    return openCursorOn(this.tx, this.data, indexEntries(this.data, this.def), query, direction, false)
  }
}

function openCursorOn(
  tx: FakeTransaction,
  data: StoreData,
  all: SourceEntry[],
  query: FakeKey | FakeKeyRange | null | undefined,
  direction: IDBCursorDirection,
  withValues: boolean,
): FakeRequest {
  const request = new FakeRequest()
  const range = asRange(query)
  let entries = all.filter((entry) => range === null || range.includes(entry.key))
  if (direction === 'nextunique' || direction === 'prevunique') entries = uniqueByKey(entries)
  if (direction === 'prev' || direction === 'prevunique') entries = entries.slice().reverse()
  const cursor = new FakeCursor(tx, data, entries, withValues, request, direction)
  tx.run(request, () => cursor.start())
  return request
}

class FakeObjectStore {
  constructor(
    private readonly tx: FakeTransaction,
    private readonly data: StoreData,
  ) {}

  get name(): string {
    return this.data.name
  }
  get keyPath(): KeyPath {
    return this.data.keyPath
  }
  get autoIncrement(): boolean {
    return this.data.autoIncrement
  }
  get indexNames(): FakeStringList {
    return new FakeStringList([...this.data.indexes.keys()])
  }

  index(name: string): FakeIndex {
    const def = this.data.indexes.get(name)
    if (def === undefined) throw dbError('NotFoundError', `No index named ${name}`)
    return new FakeIndex(this.tx, this.data, def)
  }

  createIndex(name: string, keyPath: string | string[], options?: { unique?: boolean; multiEntry?: boolean }): FakeIndex {
    if (this.tx.mode !== 'versionchange') throw dbError('InvalidStateError', 'Not in a versionchange transaction')
    const def: IndexDefinition = {
      name,
      keyPath,
      unique: options?.unique === true,
      multiEntry: options?.multiEntry === true,
    }
    this.data.indexes.set(name, def)
    return new FakeIndex(this.tx, this.data, def)
  }

  deleteIndex(name: string): void {
    if (this.tx.mode !== 'versionchange') throw dbError('InvalidStateError', 'Not in a versionchange transaction')
    this.data.indexes.delete(name)
  }

  add(value: unknown, key?: FakeKey): FakeRequest {
    return this.write('add', value, key)
  }

  put(value: unknown, key?: FakeKey): FakeRequest {
    return this.write('put', value, key)
  }

  get(query: FakeKey | FakeKeyRange): FakeRequest {
    const request = new FakeRequest()
    this.tx.record(this.data.name, 'get')
    this.tx.run(request, () => {
      const range = asRange(query)
      const hit = this.data.records.find((record) => range === null || range.includes(record.key))
      return hit === undefined ? undefined : structuredClone(hit.value)
    })
    return request
  }

  delete(query: FakeKey | FakeKeyRange): FakeRequest {
    const request = new FakeRequest()
    this.tx.record(this.data.name, 'delete')
    this.assertWritable()
    this.tx.run(request, () => {
      const range = asRange(query)
      this.tx.snapshot(this.data)
      this.data.records = this.data.records.filter((record) => range !== null && !range.includes(record.key))
      return undefined
    })
    return request
  }

  clear(): FakeRequest {
    const request = new FakeRequest()
    this.tx.record(this.data.name, 'clear')
    this.assertWritable()
    this.tx.run(request, () => {
      this.tx.snapshot(this.data)
      this.data.records = []
      return undefined
    })
    return request
  }

  count(query?: FakeKey | FakeKeyRange | null): FakeRequest {
    const request = new FakeRequest()
    this.tx.record(this.data.name, 'count')
    this.tx.run(request, () => {
      const range = asRange(query)
      return this.data.records.filter((record) => range === null || range.includes(record.key)).length
    })
    return request
  }

  openCursor(query?: FakeKey | FakeKeyRange | null, direction: IDBCursorDirection = 'next'): FakeRequest {
    this.tx.record(this.data.name, 'openCursor')
    return openCursorOn(this.tx, this.data, storeEntries(this.data), query, direction, true)
  }

  openKeyCursor(query?: FakeKey | FakeKeyRange | null, direction: IDBCursorDirection = 'next'): FakeRequest {
    this.tx.record(this.data.name, 'openKeyCursor')
    return openCursorOn(this.tx, this.data, storeEntries(this.data), query, direction, false)
  }

  private assertWritable(): void {
    if (this.tx.mode === 'readonly') throw dbError('ReadOnlyError', `${this.data.name} is open read-only`)
  }

  private write(type: 'add' | 'put', value: unknown, explicitKey?: FakeKey): FakeRequest {
    const request = new FakeRequest()
    this.tx.record(this.data.name, type)
    this.assertWritable()
    this.tx.run(request, () => {
      this.tx.snapshot(this.data)
      const stored = structuredClone(value)
      let key = explicitKey
      const keyPath = this.data.keyPath
      if (keyPath !== null) {
        if (explicitKey !== undefined) throw dbError('DataError', 'An in-line keyed store takes no key argument')
        const extracted = extractKey(stored, keyPath)
        if (extracted !== undefined) {
          key = extracted
        } else if (this.data.autoIncrement && typeof keyPath === 'string') {
          key = this.data.keyGenerator
          injectKey(stored, keyPath, key)
        } else {
          throw dbError('DataError', `No key at ${String(keyPath)}`)
        }
      } else if (key === undefined) {
        if (!this.data.autoIncrement) throw dbError('DataError', 'A key is required')
        key = this.data.keyGenerator
      }
      const finalKey = key as FakeKey
      if (typeof finalKey === 'number' && Number.isFinite(finalKey) && finalKey >= this.data.keyGenerator) {
        this.data.keyGenerator = Math.floor(finalKey) + 1
      }
      const at = this.data.records.findIndex((record) => compareKeys(record.key, finalKey) === 0)
      if (type === 'add' && at >= 0) throw dbError('ConstraintError', 'Key already exists in the object store')
      if (at >= 0) this.data.records[at] = { key: finalKey, value: stored }
      else this.insertSorted({ key: finalKey, value: stored })
      return finalKey
    })
    return request
  }

  private insertSorted(record: StoreRecord): void {
    const records = this.data.records
    let low = 0
    let high = records.length
    while (low < high) {
      const mid = (low + high) >> 1
      if (compareKeys(records[mid]!.key, record.key) < 0) low = mid + 1
      else high = mid
    }
    records.splice(low, 0, record)
  }
}

/* ── database connections and the factory ───────────────────────────────── */

/** Dexie reads object-store names by index, by `.length` and through `.contains()`. */
class FakeStringList {
  readonly length: number;
  [index: number]: string

  constructor(private readonly names: string[]) {
    this.length = names.length
    names.forEach((name, i) => {
      this[i] = name
    })
  }

  contains(name: string): boolean {
    return this.names.includes(name)
  }

  item(index: number): string | null {
    return this.names[index] ?? null
  }

  [Symbol.iterator](): IterableIterator<string> {
    return this.names[Symbol.iterator]()
  }
}

class FakeDatabase {
  onversionchange: EventHandler = null
  onclose: (() => void) | null = null
  onabort: EventHandler = null
  onerror: EventHandler = null
  closed = false
  /** Set only while an upgrade is running — `createObjectStore` is legal nowhere else. */
  versionTransaction: FakeTransaction | null = null

  constructor(
    readonly factory: FakeIndexedDbFactory,
    readonly data: DatabaseData,
  ) {}

  get name(): string {
    return this.data.name
  }
  get version(): number {
    return this.data.version
  }
  get objectStoreNames(): FakeStringList {
    return new FakeStringList([...this.data.stores.keys()])
  }

  transaction(storeNames: string | string[], mode: IDBTransactionMode = 'readonly'): FakeTransaction {
    if (this.closed) throw dbError('InvalidStateError', 'The database connection is closed')
    const names = typeof storeNames === 'string' ? [storeNames] : [...storeNames]
    for (const name of names) {
      if (!this.data.stores.has(name)) throw dbError('NotFoundError', `No object store named ${name}`)
    }
    this.factory.log.push({ database: this.name, store: names.join(','), op: 'transaction', mode })
    return new FakeTransaction(this, names, mode)
  }

  createObjectStore(name: string, options?: { keyPath?: KeyPath; autoIncrement?: boolean }): FakeObjectStore {
    const tx = this.versionTransaction
    if (tx === null) throw dbError('InvalidStateError', 'Not in a versionchange transaction')
    if (this.data.stores.has(name)) throw dbError('ConstraintError', `${name} already exists`)
    const store: StoreData = {
      name,
      keyPath: options?.keyPath ?? null,
      autoIncrement: options?.autoIncrement === true,
      indexes: new Map(),
      records: [],
      keyGenerator: 1,
    }
    this.data.stores.set(name, store)
    tx.storeNames.push(name)
    this.factory.log.push({ database: this.name, store: name, op: 'createObjectStore', mode: 'versionchange' })
    return new FakeObjectStore(tx, store)
  }

  deleteObjectStore(name: string): void {
    if (this.versionTransaction === null) throw dbError('InvalidStateError', 'Not in a versionchange transaction')
    this.data.stores.delete(name)
    this.factory.log.push({ database: this.name, store: name, op: 'deleteObjectStore', mode: 'versionchange' })
  }

  close(): void {
    this.closed = true
    this.factory.connections.delete(this)
  }
}

export class FakeIndexedDbFactory {
  readonly log: RecordedOperation[] = []
  readonly connections = new Set<FakeDatabase>()
  private readonly stores = new Map<string, DatabaseData>()
  /** Set to make every `open()` fail the way a browser with storage switched off does. */
  refuseStorage = false

  open(name: string, version?: number): FakeOpenRequest {
    const request = new FakeOpenRequest()
    this.log.push({ database: name, store: '', op: 'open' })
    queueMicrotask(() => {
      if (this.refuseStorage) {
        request.fireError(dbError('SecurityError', 'The user denied permission to access the database'))
        return
      }
      const existing = this.stores.get(name)
      const data: DatabaseData = existing ?? { name, version: 0, stores: new Map() }
      if (existing === undefined) this.stores.set(name, data)
      const target = version ?? Math.max(data.version, 1)
      if (target < data.version) {
        request.fireError(dbError('VersionError', `Requested version ${target} is older than ${data.version}`))
        return
      }
      const connection = new FakeDatabase(this, data)
      this.connections.add(connection)
      request.result = connection
      if (target === data.version) {
        request.fireSuccess(connection)
        return
      }
      const oldVersion = data.version
      data.version = target
      const tx = new FakeTransaction(connection, [...data.stores.keys()], 'versionchange')
      connection.versionTransaction = tx
      request.transaction = tx
      tx.onCompleteHook = (): void => {
        connection.versionTransaction = null
        request.transaction = null
        request.fireSuccess(connection)
      }
      tx.onAbortHook = (): void => {
        connection.versionTransaction = null
        request.transaction = null
        data.version = oldVersion
        request.fireError(tx.error ?? dbError('AbortError', 'The upgrade was aborted'))
      }
      const event = makeEvent('upgradeneeded', request)
      event.oldVersion = oldVersion
      event.newVersion = target
      request.onupgradeneeded?.(event)
    })
    return request
  }

  deleteDatabase(name: string): FakeRequest {
    const request = new FakeRequest()
    this.log.push({ database: name, store: '', op: 'deleteDatabase' })
    queueMicrotask(() => {
      if (this.refuseStorage) {
        request.fireError(dbError('SecurityError', 'The user denied permission to access the database'))
        return
      }
      for (const connection of [...this.connections]) {
        if (connection.name === name) connection.close()
      }
      this.stores.delete(name)
      request.fireSuccess(undefined)
    })
    return request
  }

  /** Implemented so Dexie does not fall back to keeping its own `__dbnames` database. */
  databases(): Promise<{ name: string; version: number }[]> {
    return Promise.resolve([...this.stores.values()].map((data) => ({ name: data.name, version: data.version })))
  }

  cmp(a: FakeKey, b: FakeKey): number {
    return compareKeys(a, b)
  }

  /* ── what tests ask it ─────────────────────────────────────────────────── */

  /** The databases that currently exist. `exitPractice` is judged on this. */
  databaseNames(): string[] {
    return [...this.stores.keys()].sort()
  }

  /** Every row of one table, exactly as stored — the byte-identity check reads this, not Dexie. */
  rows(database: string, store: string): unknown[] {
    return (this.stores.get(database)?.stores.get(store)?.records ?? []).map((record) => structuredClone(record.value))
  }

  operations(database: string): RecordedOperation[] {
    return this.log.filter((entry) => entry.database === database)
  }

  clearLog(): void {
    this.log.length = 0
  }
}

export interface FakeIndexedDb {
  factory: FakeIndexedDbFactory
  /** Cast once, here, so no production file has to know this backend exists. */
  indexedDB: IDBFactory
  IDBKeyRange: typeof IDBKeyRange
}

export function createFakeIndexedDb(): FakeIndexedDb {
  const factory = new FakeIndexedDbFactory()
  return {
    factory,
    indexedDB: factory as unknown as IDBFactory,
    IDBKeyRange: FakeKeyRange as unknown as typeof IDBKeyRange,
  }
}
