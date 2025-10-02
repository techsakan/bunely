/**
 * CREATE INDEX query builder
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import type { CreateIndexBuilder as ICreateIndexBuilder } from "../types";

export class CreateIndexBuilder implements ICreateIndexBuilder {
    private db: SQLiteDatabase;
    private name: string;
    private table: string = "";
    private _columns: string[] = [];
    private _unique: boolean = false;
    private _where: string = "";
    private _ifNotExists: boolean = false;

    constructor(db: SQLiteDatabase, name: string) {
        this.db = db;
        this.name = name;
    }

    on(table: string): CreateIndexBuilder {
        this.table = table;
        return this;
    }

    columns(cols: string[]): CreateIndexBuilder {
        this._columns = cols;
        return this;
    }

    unique(value: boolean = true): CreateIndexBuilder {
        this._unique = value;
        return this;
    }

    where(condition: string): CreateIndexBuilder {
        this._where = condition;
        return this;
    }

    ifNotExists(value: boolean = true): CreateIndexBuilder {
        this._ifNotExists = value;
        return this;
    }

    toSQL(): string {
        if (!this.table) {
            throw new Error("Table name is required. Use .on() to specify the table.");
        }

        if (this._columns.length === 0) {
            throw new Error("Columns are required. Use .columns() to specify the columns.");
        }

        const uniqueClause = this._unique ? "UNIQUE" : "";
        const ifNotExistsClause = this._ifNotExists ? "IF NOT EXISTS" : "";
        const whereClause = this._where ? ` WHERE ${this._where}` : "";
        const columnList = this._columns.map(col => `"${col}"`).join(", ");

        return `CREATE ${uniqueClause} INDEX ${ifNotExistsClause} "${this.name}" ON "${this.table}" (${columnList})${whereClause}`;
    }

    async execute(): Promise<void> {
        const sql = this.toSQL();
        this.db.exec(sql);
    }
}
