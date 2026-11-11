import { PianoDrillDB } from './db'
import { Storage } from './repositories'

export { exportBackup, importBackup, parseBackup, BACKUP_VERSION } from './backup'
export type { Backup, ImportMode } from './backup'
export { PianoDrillDB } from './db'
export { Storage } from './repositories'
export type * from './types'

let shared: Storage | null = null

/** The app's one Storage, opened on first use. */
export function getStorage(): Storage {
  shared ??= new Storage(new PianoDrillDB())
  return shared
}
