import * as SQLite from 'expo-sqlite'

/**
 * Clears all LiveStore databases for the app
 * Use this when schema changes cause MaterializerHashMismatchError
 */
export async function clearLiveStoreDatabase() {
  try {
    const db = await SQLite.openDatabaseAsync('livestore-nessei-sitelink-dev')

    // Get all tables
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )

    // Drop all tables
    for (const table of tables) {
      await db.execAsync(`DROP TABLE IF EXISTS "${table.name}"`)
    }

    console.log('[DATABASE] Cleared all LiveStore tables')
    return true
  } catch (error) {
    console.error('[DATABASE] Error clearing database:', error)
    return false
  }
}
