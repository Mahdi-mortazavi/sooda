/**
 * A backup of the practice shop, for the lesson that teaches backing up.
 *
 * `src/lib/backup.ts` reads the real database and every `sooda:` key in localStorage — which is
 * exactly right for the real button and exactly wrong inside a lesson. A lesson that called it
 * would hand the shopkeeper a file full of their own prices while claiming to be practice, so the
 * sandbox builds its own file, out of the practice database and nothing else.
 *
 * The file shape is the app's: a shopkeeper who saves it and opens it later should see the same
 * thing the real export produces, minus their data.
 */

import type { BackupFile } from '../../lib/backup'
import type { PracticeDb } from './db'

/**
 * Must equal `BACKUP_VERSION` in `src/lib/backup.ts`; a test asserts it does.
 *
 * It is a literal rather than an import because importing that module would pull the real `db`
 * into the practice module graph — see the header of `./db.ts`.
 */
export const PRACTICE_BACKUP_VERSION = 2

/**
 * Everything in the practice shop, as a backup file.
 *
 * `settings` is empty on purpose: the real exporter walks localStorage for the user's language,
 * currency and rounding preferences, and reading those during practice is precisely the kind of
 * access this whole module exists to avoid. A practice backup is about the shop, not the phone.
 */
export async function buildPracticeBackup(db: PracticeDb, now: number): Promise<BackupFile> {
  const [products, history, basket, observations, storeProfile] = await Promise.all([
    db.products.toArray(),
    db.history.toArray(),
    db.basket.toArray(),
    db.observations.toArray(),
    db.storeProfile.get('me'),
  ])
  return {
    app: 'sooda',
    version: PRACTICE_BACKUP_VERSION,
    exportedAt: now,
    products,
    history,
    basket,
    observations,
    storeProfile: storeProfile ?? null,
    settings: {},
  }
}
