/**
 * UPDATE query builder
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import { BaseQueryBuilder } from "./base";
import type { WhereClause, WhereOperator } from "../types";

export class UpdateQueryBuilder extends BaseQueryBuilder implements UpdateQueryBuilder {
    private table: string;
    private setData: Record<string, any> = {};
    private whereConditions: string[] = [];
    private whereParams: any[] = [];
    private returningColumns: string[] = [];

    constructor(db: SQLiteDatabase, table: string) {
        super(db);
        this.table = table;
    }

    set(data: Record<string, any>): UpdateQueryBuilder {
        this.setData = data;
        return this;
    }

    where(conditions: WhereClause): UpdateQueryBuilder;
    where(column: string, operator: WhereOperator, value: any): UpdateQueryBuilder;
    where(column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any): UpdateQueryBuilder;
    where(column: string, operator: "IN" | "NOT IN", values: any[]): UpdateQueryBuilder;
    where(
        columnOrConditions: string | WhereClause, 
        operator?: WhereOperator, 
        value?: any, 
        value2?: any
    ): UpdateQueryBuilder {
        if (typeof columnOrConditions === "string") {
            // Explicit where condition: .where("id", "=", value)
            const column = columnOrConditions;
            const op = operator!;
            const val = value;
            
            // Add AND prefix if there are already conditions
            const prefix = this.whereConditions.length > 0 ? "AND " : "";
            
            if (op === "BETWEEN" || op === "NOT BETWEEN") {
                this.whereConditions.push(`${prefix}"${column}" ${op} ? AND ?`);
                this.whereParams.push(val, value2);
            } else if (op === "IN" || op === "NOT IN") {
                const placeholders = (val as any[]).map(() => "?").join(", ");
                this.whereConditions.push(`${prefix}"${column}" ${op} (${placeholders})`);
                this.whereParams.push(...(val as any[]));
            } else if (op === "IS NULL" || op === "IS NOT NULL") {
                this.whereConditions.push(`${prefix}"${column}" ${op}`);
            } else {
                this.whereConditions.push(`${prefix}"${column}" ${op} ?`);
                this.whereParams.push(val);
            }
        } else {
            // Object where condition: .where({ id: value })
            const whereClause = this.buildWhereClause(columnOrConditions);
            if (whereClause) {
                // Add AND prefix if there are already conditions
                const prefix = this.whereConditions.length > 0 ? "AND " : "";
                this.whereConditions.push(`${prefix}${whereClause.clause}`);
                this.whereParams.push(...whereClause.params);
            }
        }
        return this;
    }

    whereRaw(sql: string, params: any[] = []): UpdateQueryBuilder {
        // Add AND prefix if there are already conditions
        const prefix = this.whereConditions.length > 0 ? "AND " : "";
        this.whereConditions.push(`${prefix}${sql}`);
        this.whereParams.push(...params);
        return this;
    }

    orWhere(conditions: WhereClause): UpdateQueryBuilder;
    orWhere(column: string, operator: WhereOperator, value: any): UpdateQueryBuilder;
    orWhere(column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any): UpdateQueryBuilder;
    orWhere(column: string, operator: "IN" | "NOT IN", values: any[]): UpdateQueryBuilder;
    orWhere(
        columnOrConditions: string | WhereClause, 
        operator?: WhereOperator, 
        value?: any, 
        value2?: any
    ): UpdateQueryBuilder {
        if (typeof columnOrConditions === "string") {
            // Explicit OR where condition: .orWhere("id", "=", value)
            const column = columnOrConditions;
            const op = operator!;
            const val = value;
            
            if (op === "BETWEEN" || op === "NOT BETWEEN") {
                this.whereConditions.push(`OR "${column}" ${op} ? AND ?`);
                this.whereParams.push(val, value2);
            } else if (op === "IN" || op === "NOT IN") {
                const placeholders = (val as any[]).map(() => "?").join(", ");
                this.whereConditions.push(`OR "${column}" ${op} (${placeholders})`);
                this.whereParams.push(...(val as any[]));
            } else if (op === "IS NULL" || op === "IS NOT NULL") {
                this.whereConditions.push(`OR "${column}" ${op}`);
            } else {
                this.whereConditions.push(`OR "${column}" ${op} ?`);
                this.whereParams.push(val);
            }
        } else {
            // Object OR where condition: .orWhere({ id: value })
            const whereClause = this.buildWhereClause(columnOrConditions);
            if (whereClause) {
                // Add OR prefix to the first condition in the clause
                const orClause = whereClause.clause.replace(/^/, "OR ");
                this.whereConditions.push(orClause);
                this.whereParams.push(...whereClause.params);
            }
        }
        return this;
    }

    orWhereRaw(sql: string, params: any[] = []): UpdateQueryBuilder {
        this.whereConditions.push(`OR ${sql}`);
        this.whereParams.push(...params);
        return this;
    }

    returning(columns: string | string[]): UpdateQueryBuilder {
        this.returningColumns = Array.isArray(columns) ? columns : [columns];
        return this;
    }

    async execute(): Promise<{ changes: number }> {
        this.buildSQL();
        const result = this.executeRun(this.sql, this.params);
        return { changes: result.changes };
    }

    private buildSQL(): void {
        if (Object.keys(this.setData).length === 0) {
            throw new Error("Set data is required. Use .set() to specify the data to update.");
        }

        const setClauses = Object.keys(this.setData).map(key => `"${key}" = ?`);
        const setValues = Object.values(this.setData);

        let sql = `UPDATE "${this.table}" SET ${setClauses.join(", ")}`;

        if (this.whereConditions.length > 0) {
            // Join conditions with proper AND/OR logic
            const whereClause = this.whereConditions.join(" ");
            sql += ` WHERE ${whereClause}`;
        }

        if (this.returningColumns.length > 0) {
            const returningCols = this.returningColumns.map(col => `"${col}"`).join(", ");
            sql += ` RETURNING ${returningCols}`;
        }

        this.sql = sql;
        this.params = [...setValues, ...this.whereParams];
    }

    private buildWhereClause(conditions: WhereClause): { clause: string; params: any[] } | null {
        const clauses: string[] = [];
        const params: any[] = [];

        for (const [key, value] of Object.entries(conditions)) {
            if (value === null) {
                clauses.push(`"${key}" IS NULL`);
            } else if (value === undefined) {
                continue;
            } else {
                clauses.push(`"${key}" = ?`);
                params.push(value);
            }
        }

        return clauses.length > 0 ? { clause: clauses.join(" AND "), params } : null;
    }
}
