/**
 * DROP INDEX query builder
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import type { DropIndexBuilder as IDropIndexBuilder } from "../types";

export class DropIndexBuilder implements IDropIndexBuilder {
    private db: SQLiteDatabase;
    private name: string;
    private _ifExists: boolean = false;

    constructor(db: SQLiteDatabase, name: string) {
        this.db = db;
        this.name = name;
    }

    ifExists(value: boolean = true): DropIndexBuilder {
        this._ifExists = value;
        return this;
    }

    toSQL(): string {
        const ifExistsClause = this._ifExists ? "IF EXISTS" : "";
        return `DROP INDEX ${ifExistsClause} "${this.name}"`;
    }

    async execute(): Promise<void> {
        const sql = this.toSQL();
        this.db.exec(sql);
    }
}
