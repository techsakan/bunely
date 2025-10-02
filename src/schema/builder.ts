/**
 * Schema builder for database schema management
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import type { SchemaBuilder as ISchemaBuilder, ColumnDefinition, ForeignKeyDefinition, IndexDefinition } from "../types";
import { CreateTableBuilder } from "./create-table";
import { DropTableBuilder } from "./drop-table";
import { AlterTableBuilder } from "./alter-table";
import { CreateIndexBuilder } from "./create-index";
import { DropIndexBuilder } from "./drop-index";

export class SchemaBuilder implements ISchemaBuilder {
    private db: SQLiteDatabase;
    private isTransaction: boolean = false;

    constructor(db: SQLiteDatabase, isTransaction: boolean = false) {
        this.db = db;
        this.isTransaction = isTransaction;
    }

    createTable(name: string): CreateTableBuilder {
        return new CreateTableBuilder(this.db, name);
    }

    dropTable(name: string): DropTableBuilder {
        return new DropTableBuilder(this.db, name);
    }

    alterTable(name: string): AlterTableBuilder {
        return new AlterTableBuilder(this.db, name, this.isTransaction);
    }

    createIndex(name: string): CreateIndexBuilder {
        return new CreateIndexBuilder(this.db, name);
    }

    dropIndex(name: string): DropIndexBuilder {
        return new DropIndexBuilder(this.db, name);
    }

    async renameTable(oldName: string, newName: string): Promise<void> {
        // Use SQLite's ALTER TABLE RENAME TO command
        this.db.exec(`ALTER TABLE "${oldName}" RENAME TO "${newName}"`);
    }

    async hasTable(name: string): Promise<boolean> {
        const result = this.db.prepare(
            "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?"
        ).get(name) as { count: number };
        return result.count > 0;
    }

    async hasColumn(table: string, column: string): Promise<boolean> {
        const result = this.db.prepare(
            "SELECT COUNT(*) as count FROM pragma_table_info(?) WHERE name=?"
        ).get(table, column) as { count: number };
        return result.count > 0;
    }

    async getTableInfo(name: string): Promise<ColumnDefinition[]> {
        const columns = this.db.prepare(
            "SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info(?)"
        ).all(name) as any[];

        // Get original CREATE TABLE statement to extract unique constraints
        const createTableStmt = this.db.prepare(
            `SELECT sql FROM sqlite_master WHERE type='table' AND name='${name}'`
        ).get() as { sql: string };

        // Get indexes to check for unique constraints
        const indexes = this.db.prepare(
            `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='${name}' AND name NOT LIKE 'sqlite_%'`
        ).all(name) as any[];

        // Extract unique constraints from CREATE TABLE statement
        const uniqueConstraintsFromTable = this.extractUniqueConstraints(createTableStmt?.sql || '');

        // Extract unique constraints from indexes
        const uniqueConstraintsFromIndexes = this.extractUniqueConstraintsFromIndexes(indexes);

        // Merge both sets of unique constraints
        const allUniqueConstraints = new Set([...uniqueConstraintsFromTable, ...uniqueConstraintsFromIndexes]);

        return columns.map(col => ({
            name: col.name,
            type: col.type as any,
            primaryKey: col.pk === 1,
            notNull: col.notnull === 1,
            defaultValue: this.parseDefaultValue(col.dflt_value),
            unique: allUniqueConstraints.has(col.name)
        }));
    }

    private parseDefaultValue(dflt_value: any): any {
        if (dflt_value === null || dflt_value === undefined) {
            return dflt_value;
        }
        
        // SQLite returns "null" as a string when DEFAULT NULL is used
        if (dflt_value === "null") {
            return null;
        }
        
        // SQLite returns "true"/"false" as strings for boolean defaults
        if (dflt_value === "true") {
            return true;
        }
        if (dflt_value === "false") {
            return false;
        }
        
        // Try to parse numbers
        if (typeof dflt_value === "string" && !isNaN(Number(dflt_value))) {
            const num = Number(dflt_value);
            if (Number.isInteger(num)) {
                return num;
            } else {
                return num;
            }
        }
        
        return dflt_value;
    }

    async getForeignKeys(name: string): Promise<ForeignKeyDefinition[]> {
        const fks = this.db.prepare(
            "SELECT * FROM pragma_foreign_key_list(?)"
        ).all(name) as any[];

        return fks.map(fk => ({
            column: fk.from,
            references: {
                table: fk.table,
                column: fk.to
            },
            onDelete: fk.on_delete as any,
            onUpdate: fk.on_update as any
        }));
    }

    async getIndexes(name: string): Promise<IndexDefinition[]> {
        const indexes = this.db.prepare(
            "SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND name NOT LIKE 'sqlite_%'"
        ).all(name) as any[];

        return indexes.map(idx => ({
            name: idx.name,
            columns: this.extractColumnsFromIndexSQL(idx.sql),
            unique: idx.sql?.includes('UNIQUE') || false,
            sql: idx.sql
        }));
    }

    private extractColumnsFromIndexSQL(sql: string): string[] {
        if (!sql) return [];
        const match = sql.match(/\(([^)]+)\)/);
        if (!match) return [];
        return match[1]!.split(',').map(col => col.trim().replace(/"/g, ''));
    }

    private extractUniqueConstraints(createTableSQL: string): Set<string> {
        const uniqueColumns = new Set<string>();

        if (!createTableSQL) return uniqueColumns;

        // Regex to find UNIQUE constraints in column definitions
        // This matches patterns like:
        // - "column_name TYPE UNIQUE"
        // - "column_name TYPE PRIMARY KEY UNIQUE"
        // - "column_name TYPE NOT NULL UNIQUE"
        // - "column_name TYPE PRIMARY KEY UNIQUE NOT NULL"
        // - "column_name TYPE NOT NULL PRIMARY KEY UNIQUE"
        const uniqueRegex = /"([^"]+)"\s+\w+(?:\s+(?:NOT\s+NULL|PRIMARY\s+KEY))*\s+UNIQUE/g;
        let match;

        while ((match = uniqueRegex.exec(createTableSQL)) !== null) {
            uniqueColumns.add(match[1]!);
        }

        return uniqueColumns;
    }

    private extractUniqueConstraintsFromIndexes(indexes: any[]): Set<string> {
        const uniqueColumns = new Set<string>();

        for (const index of indexes) {
            if (index.sql && index.sql.includes('UNIQUE')) {
                // Extract column names from the index SQL
                // Example: CREATE UNIQUE INDEX "idx_name" ON "table" ("column1", "column2")
                const match = index.sql.match(/\(([^)]+)\)/);
                if (match) {
                    const columns = match[1].split(',').map((col: string) =>
                        col.trim().replace(/"/g, '')
                    );
                    // Only add individual columns as unique if it's a single-column unique index
                    if (columns.length === 1) {
                        columns.forEach((col: string) => uniqueColumns.add(col));
                    }
                    // For composite unique indexes, we don't mark individual columns as unique
                }
            }
        }

        return uniqueColumns;
    }
}
