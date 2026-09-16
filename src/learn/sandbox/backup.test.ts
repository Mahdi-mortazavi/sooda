/**
 * The practice backup: the same file the real exporter writes, built from the demo shop, carrying
 * none of the shopkeeper's settings.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { BACKUP_VERSION, validateBackup } from '../../lib/backup'
import { buildPracticeBackup, PRACTICE_BACKUP_VERSION } from './backup'
import { enterPractice, exitPractice, type PracticeSession } from './session'
import { createFakeIndexedDb, type FakeIndexedDb } from './testing/fakeIndexedDb'

const NOW = Date.UTC(2026, 8, 15, 9, 0, 0)

let backend: FakeIndexedDb
let session: PracticeSession

beforeEach(async () => {
  await exitPractice()
  backend = createFakeIndexedDb()
  const entered = await enterPractice({ now: NOW, indexedDB: backend.indexedDB, IDBKeyRange: backend.IDBKeyRange })
  if (!entered.ok) throw new Error('practice refused to start')
  session = entered.session
})

describe('a backup taken in practice', () => {
  it('writes the version the real exporter writes', () => {
    expect(PRACTICE_BACKUP_VERSION).toBe(BACKUP_VERSION)
  })

  it('passes the app’s own validator, so a lesson can hand the file straight to it', async () => {
    const file = await buildPracticeBackup(session.db, NOW)
    const checked = validateBackup(JSON.stringify(file))
    expect(checked.ok).toBe(true)
    if (!checked.ok) return
    expect(checked.data.products).toHaveLength(5)
    expect(checked.data.observations.length).toBeGreaterThan(5)
    expect(checked.data.storeProfile?.categories[0]).toBe('food')
  })

  it('carries no settings — those belong to the shopkeeper, not to the demo shop', async () => {
    const file = await buildPracticeBackup(session.db, NOW)
    expect(file.settings).toEqual({})
    expect(file.exportedAt).toBe(NOW)
    expect(file.history).toEqual([])
    expect(file.basket).toEqual([])
  })
})
