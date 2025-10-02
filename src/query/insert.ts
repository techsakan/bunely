/**
 * INSERT query builder
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import { BaseQueryBuilder } from "./base";

export class InsertQueryBuilder extends BaseQueryBuilder implements InsertQueryBuilder {
    private table: string;
    private data: Record<string, any> | Record<string, any>[] = [];
    private returningColumns: string[] = [];

    constructor(db: SQLiteDatabase, table: string) {
        super(db);
        this.table = table;
    }

    values(data: Record<string, any> | Record<string, any>[]): InsertQueryBuilder {
        this.data = data;
        return this;
    }

    returning(columns: string | string[]): InsertQueryBuilder {
        this.returningColumns = Array.isArray(columns) ? columns : [columns];
        return this;
    }

    async execute(): Promise<{ lastInsertRowid: number; changes: number }> {
        this.buildSQL();
        const result = this.executeRun(this.sql, this.params);
        return {
            lastInsertRowid: Number(result.lastInsertRowid),
            changes: result.changes
        };
    }

    private buildSQL(): void {
        if (!this.data || (Array.isArray(this.data) && this.data.length === 0)) {
            throw new Error("Data is required. Use .values() to specify the data to insert.");
        }

        const dataArray = Array.isArray(this.data) ? this.data : [this.data];
        const firstRow = dataArray[0];
        const columns = Object.keys(firstRow);
        const quotedColumns = columns.map(col => `"${col}"`).join(", ");
        const placeholders = columns.map(() => "?").join(", ");

        let sql = `INSERT INTO "${this.table}" (${quotedColumns}) VALUES `;

        const valueClauses: string[] = [];
        const params: any[] = [];

        for (const row of dataArray) {
            valueClauses.push(`(${placeholders})`);
            params.push(...columns.map(col => row[col]));
        }

        sql += valueClauses.join(", ");

        if (this.returningColumns.length > 0) {
            const returningCols = this.returningColumns.map(col => `"${col}"`).join(", ");
            sql += ` RETURNING ${returningCols}`;
        }

        this.sql = sql;
        this.params = params;
    }
}
