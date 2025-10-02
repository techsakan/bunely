/**
 * Schema Utilities for Bunely
 * 
 * Common schema operations and utilities for working with SQLite databases
 */

import { Database } from "bun:sqlite";
import { Bunely } from "./index";

export interface TableInfo {
    name: string;
    type: string;
    notnull: boolean;
    dflt_value: any;
    pk: boolean;
}

export interface IndexInfo {
    name: string;
    table: string;
    sql: string;
}

export interface ForeignKeyInfo {
    table: string;
    from: string;
    to: string;
    on_delete: string;
    on_update: string;
}

/**
 * Schema utilities for Bunely
 */
export class SchemaUtils {
    private bunely: Bunely;
    private db: Database;

    constructor(db: Database) {
        this.db = db;
        this.bunely = new Bunely(db);
    }

    /**
     * Enable foreign key constraints
     */
    enableForeignKeys(): void {
        this.db.exec("PRAGMA foreign_keys = ON");
    }

    /**
     * Check if foreign key constraints are enabled
     */
    areForeignKeysEnabled(): boolean {
        const result = this.bunely.get<{ foreign_keys: number }>("PRAGMA foreign_keys");
        return result?.foreign_keys === 1;
    }

    /**
     * Get all tables in the database
     */
    getAllTables(): string[] {
        const tables = this.bunely.all<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        return tables.map(t => t.name);
    }

    /**
     * Check if a table exists
     */
    tableExists(tableName: string): boolean {
        const result = this.bunely.get<{ count: number }>(
            "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?",
            [tableName]
        );
        return (result?.count || 0) > 0;
    }

    /**
     * Get table structure information
     */
    getTableInfo(tableName: string): TableInfo[] {
        return this.bunely.all<TableInfo>(
            "SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info(?)",
            [tableName]
        );
    }

    /**
     * Get all indexes for a table
     */
    getTableIndexes(tableName: string): IndexInfo[] {
        return this.bunely.all<IndexInfo>(
            "SELECT name, tbl_name as \"table\", sql FROM sqlite_master WHERE type='index' AND tbl_name=?",
            [tableName]
        );
    }

    /**
     * Get foreign key information for a table
     */
    getForeignKeys(tableName: string): ForeignKeyInfo[] {
        return this.bunely.all<ForeignKeyInfo>(
            "SELECT * FROM pragma_foreign_key_list(?)",
            [tableName]
        );
    }

    /**
     * Create a table with common patterns
     */
    createTable(tableName: string, columns: string, ifNotExists: boolean = true): void {
        const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS" : "";
        this.db.exec(`CREATE TABLE ${ifNotExistsClause} ${tableName} (${columns})`);
    }

    /**
     * Create an index
     */
    createIndex(indexName: string, tableName: string, columns: string, unique: boolean = false): void {
        const uniqueClause = unique ? "UNIQUE" : "";
        this.db.exec(`CREATE ${uniqueClause} INDEX ${indexName} ON ${tableName} (${columns})`);
    }

    /**
     * Drop a table
     */
    dropTable(tableName: string, ifExists: boolean = true): void {
        const ifExistsClause = ifExists ? "IF EXISTS" : "";
        this.db.exec(`DROP TABLE ${ifExistsClause} ${tableName}`);
    }

    /**
     * Drop an index
     */
    dropIndex(indexName: string, ifExists: boolean = true): void {
        const ifExistsClause = ifExists ? "IF EXISTS" : "";
        this.db.exec(`DROP INDEX ${ifExistsClause} ${indexName}`);
    }

    /**
     * Add a column to an existing table
     */
    addColumn(tableName: string, columnName: string, columnDefinition: string): void {
        this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }

    /**
     * Get database schema as SQL
     */
    getSchemaSQL(): string {
        const tables = this.getAllTables();
        let schema = "";
        
        for (const table of tables) {
            const createTable = this.bunely.get<{ sql: string }>(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
                [table]
            );
            if (createTable?.sql) {
                schema += createTable.sql + ";\n\n";
            }
        }
        
        return schema;
    }

    /**
     * Validate table structure
     */
    validateTableStructure(tableName: string, expectedColumns: string[]): {
        valid: boolean;
        missing: string[];
        extra: string[];
    } {
        if (!this.tableExists(tableName)) {
            return { valid: false, missing: expectedColumns, extra: [] };
        }

        const actualColumns = this.getTableInfo(tableName).map(col => col.name);
        const missing = expectedColumns.filter(col => !actualColumns.includes(col));
        const extra = actualColumns.filter(col => !expectedColumns.includes(col));

        return {
            valid: missing.length === 0 && extra.length === 0,
            missing,
            extra
        };
    }

    /**
     * Create common table patterns
     */
    createUserTable(tableName: string = "users"): void {
        this.createTable(tableName, `
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            first_name TEXT,
            last_name TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        `);
    }

    createAuditTable(tableName: string = "audit_log"): void {
        this.createTable(tableName, `
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            record_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            old_values TEXT,
            new_values TEXT,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        `);
    }

    createSoftDeleteTable(tableName: string, columns: string): void {
        this.createTable(tableName, `
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ${columns},
            deleted_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        `);
    }

    /**
     * Create common indexes
     */
    createCommonIndexes(): void {
        const tables = this.getAllTables();
        
        for (const table of tables) {
            const tableInfo = this.getTableInfo(table);
            
            // Create indexes for common patterns
            for (const column of tableInfo) {
                if (column.name === 'email' && column.type === 'TEXT') {
                    this.createIndex(`idx_${table}_email`, table, 'email', true);
                }
                if (column.name === 'username' && column.type === 'TEXT') {
                    this.createIndex(`idx_${table}_username`, table, 'username', true);
                }
                if (column.name.endsWith('_id') && column.type === 'INTEGER') {
                    this.createIndex(`idx_${table}_${column.name}`, table, column.name);
                }
                if (column.name === 'created_at' && column.type === 'DATETIME') {
                    this.createIndex(`idx_${table}_created_at`, table, 'created_at');
                }
            }
        }
    }
}

/**
 * Schema migration utilities
 */
export class SchemaMigration {
    private bunely: Bunely;
    private db: Database;

    constructor(db: Database) {
        this.db = db;
        this.bunely = new Bunely(db);
        this.initMigrationTable();
    }

    private initMigrationTable(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    /**
     * Get current migration version
     */
    getCurrentVersion(): number {
        const result = this.bunely.get<{ version: number }>(
            "SELECT MAX(version) as version FROM schema_migrations"
        );
        return result?.version || 0;
    }

    /**
     * Apply a migration
     */
    async applyMigration(version: number, description: string, up: () => void): Promise<void> {
        const currentVersion = this.getCurrentVersion();
        
        if (version <= currentVersion) {
            console.log(`Migration ${version} already applied`);
            return;
        }

        await this.bunely.transaction(async (tx) => {
            console.log(`Applying migration ${version}: ${description}`);
            up();
            
            tx.insert("schema_migrations", {
                version,
                description
            });
        });
    }

    /**
     * Get applied migrations
     */
    getAppliedMigrations(): Array<{ version: number; description: string; applied_at: string }> {
        return this.bunely.all(
            "SELECT version, description, applied_at FROM schema_migrations ORDER BY version"
        );
    }
}

// Export convenience functions
export function createSchemaUtils(db: Database): SchemaUtils {
    return new SchemaUtils(db);
}

export function createSchemaMigration(db: Database): SchemaMigration {
    return new SchemaMigration(db);
}
