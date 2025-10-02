/**
 * DROP TABLE query builder
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import type { DropTableBuilder as IDropTableBuilder } from "../types";

export class DropTableBuilder implements IDropTableBuilder {
    private db: SQLiteDatabase;
    private name: string;
    private _ifExists: boolean = false;

    constructor(db: SQLiteDatabase, name: string) {
        this.db = db;
        this.name = name;
    }

    ifExists(value: boolean = true): DropTableBuilder {
        this._ifExists = value;
        return this;
    }

    toSQL(): string {
        const ifExistsClause = this._ifExists ? "IF EXISTS" : "";
        return `DROP TABLE ${ifExistsClause} "${this.name}"`;
    }

    async execute(): Promise<void> {
        const sql = this.toSQL();
        this.db.exec(sql);
    }
}
