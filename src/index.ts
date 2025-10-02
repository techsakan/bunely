/**
 * Bunely - A modern SQLite wrapper with query builder and schema management
 * 
 * @fileoverview Provides a fluent API for SQLite operations with query builder,
 * schema management, and transaction support.
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import { Database } from "./core/database";
import * as types from "./types";

/**
 * Create a new Bunely database instance
 */
export function createDatabase(
    db: SQLiteDatabase, 
    options?: { busyTimeoutMs?: number }
): Database {
    return new Database(db, options);
}

/**
 * Create a new in-memory database
 */
export function createMemoryDatabase(options?: { busyTimeoutMs?: number }): Database {
    const db = new SQLiteDatabase(":memory:");
    return new Database(db, options);
}

/**
 * Create a new file-based database
 */
export function createFileDatabase(
    filename: string, 
    options?: { busyTimeoutMs?: number }
): Database {
    const db = new SQLiteDatabase(filename);
    return new Database(db, options);
}

// Export the main Database class
export { Database } from "./core/database";

// Export all types
export * from "./types";

// Export individual query builders for advanced usage
export { SelectQueryBuilder } from "./query/select";
export { InsertQueryBuilder } from "./query/insert";
export { UpdateQueryBuilder } from "./query/update";
export { DeleteQueryBuilder } from "./query/delete";

// Export schema builders
export { SchemaBuilder } from "./schema/builder";
export { CreateTableBuilder } from "./schema/create-table";
export { DropTableBuilder } from "./schema/drop-table";
export { AlterTableBuilder } from "./schema/alter-table";
export { CreateIndexBuilder } from "./schema/create-index";
export { DropIndexBuilder } from "./schema/drop-index";

// Legacy compatibility - export as Bunely for backward compatibility
export { Database as Bunely } from "./core/database";
