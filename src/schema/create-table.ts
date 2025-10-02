/**
 * CREATE TABLE query builder
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import type { CreateTableBuilder as ICreateTableBuilder, ColumnDefinition, ForeignKeyDefinition, IndexDefinition } from "../types";

export class CreateTableBuilder implements ICreateTableBuilder {
    private db: SQLiteDatabase;
    private name: string;
    private columns: ColumnDefinition[] = [];
    private foreignKeys: ForeignKeyDefinition[] = [];
    private indexes: IndexDefinition[] = [];
    private _ifNotExists: boolean = false;

    constructor(db: SQLiteDatabase, name: string) {
        this.db = db;
        this.name = name;
    }

    addColumn(column: ColumnDefinition): CreateTableBuilder {
        this.columns.push(column);
        return this;
    }

    addForeignKey(fk: ForeignKeyDefinition): CreateTableBuilder {
        console.log("Adding foreign key:", fk);
        this.foreignKeys.push(fk);
        return this;
    }

    addIndex(index: IndexDefinition): CreateTableBuilder {
        this.indexes.push(index);
        return this;
    }

    ifNotExists(value: boolean = true): CreateTableBuilder {
        this._ifNotExists = value;
        return this;
    }

    toSQL(): string {
        if (this.columns.length === 0) {
            throw new Error("At least one column is required");
        }

        const ifNotExistsClause = this._ifNotExists ? "IF NOT EXISTS" : "";
        const columnDefinitions = this.columns.map(col => this.buildColumnDefinition(col));
        const foreignKeyDefinitions = this.foreignKeys.map(fk => this.buildForeignKeyDefinition(fk));

        const allDefinitions = [...columnDefinitions, ...foreignKeyDefinitions];
        const sql = `CREATE TABLE ${ifNotExistsClause} "${this.name}" (${allDefinitions.join(", ")})`;

        return sql;
    }

    async execute(): Promise<void> {
        const sql = this.toSQL();
        this.db.exec(sql);

        // Create indexes after table creation
        for (const index of this.indexes) {
            const indexSQL = this.buildIndexSQL(index);
            this.db.exec(indexSQL);
        }
    }

    private buildColumnDefinition(column: ColumnDefinition): string {
        let definition = `"${column.name}" ${column.type}`;

        if (column.primaryKey) {
            definition += " PRIMARY KEY";
        }

        if (column.autoIncrement) {
            definition += " AUTOINCREMENT";
        }

        if (column.notNull) {
            definition += " NOT NULL";
        }

        if (column.unique) {
            definition += " UNIQUE";
        }

        if (column.defaultValue !== undefined) {
            if (typeof column.defaultValue === 'string') {
                definition += ` DEFAULT '${column.defaultValue}'`;
            } else {
                definition += ` DEFAULT ${column.defaultValue}`;
            }
        }

        if (column.check) {
            definition += ` CHECK (${column.check})`;
        }

        return definition;
    }

    private buildForeignKeyDefinition(fk: ForeignKeyDefinition): string {
        let definition = `FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references.table}" ("${fk.references.column}")`;

        if (fk.onDelete) {
            definition += ` ON DELETE ${fk.onDelete}`;
        }

        if (fk.onUpdate) {
            definition += ` ON UPDATE ${fk.onUpdate}`;
        }

        return definition;
    }

    private buildIndexSQL(index: IndexDefinition): string {
        const ifNotExistsClause = index.unique ? "UNIQUE INDEX" : "INDEX";
        const uniqueClause = index.unique ? "UNIQUE" : "";
        const whereClause = index.where ? ` WHERE ${index.where}` : "";
        const columns = index.columns.map(col => `"${col}"`).join(", ");

        return `CREATE ${uniqueClause} ${ifNotExistsClause} "${index.name}" ON "${this.name}" (${columns})${whereClause}`;
    }
}
