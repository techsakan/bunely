/**
 * SELECT query builder
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import { BaseQueryBuilder } from "./base";
import type { WhereClause, WhereOperator } from "../types";

export class SelectQueryBuilder extends BaseQueryBuilder implements SelectQueryBuilder {
    private columns: string = "*";
    private table: string = "";
    private joins: string[] = [];
    private whereConditions: string[] = [];
    private whereParams: any[] = [];
    private orderByClause: string = "";
    private groupByClause: string = "";
    private havingConditions: string[] = [];
    private havingParams: any[] = [];
    private limitClause: string = "";
    private offsetClause: string = "";

    constructor(db: SQLiteDatabase, columns?: string | string[]) {
        super(db);
        if (columns) {
            this.columns = Array.isArray(columns) ? columns.join(", ") : columns;
        }
    }

    from(table: string): SelectQueryBuilder {
        this.table = table;
        return this;
    }

    where(conditions: WhereClause): SelectQueryBuilder;
    where(column: string, operator: WhereOperator, value: any): SelectQueryBuilder;
    where(column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any): SelectQueryBuilder;
    where(column: string, operator: "IN" | "NOT IN", values: any[]): SelectQueryBuilder;
    where(
        columnOrConditions: string | WhereClause, 
        operator?: WhereOperator, 
        value?: any, 
        value2?: any
    ): SelectQueryBuilder {
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

    whereRaw(sql: string, params: any[] = []): SelectQueryBuilder {
        // Add AND prefix if there are already conditions
        const prefix = this.whereConditions.length > 0 ? "AND " : "";
        this.whereConditions.push(`${prefix}${sql}`);
        this.whereParams.push(...params);
        return this;
    }

    orWhere(conditions: WhereClause): SelectQueryBuilder;
    orWhere(column: string, operator: WhereOperator, value: any): SelectQueryBuilder;
    orWhere(column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any): SelectQueryBuilder;
    orWhere(column: string, operator: "IN" | "NOT IN", values: any[]): SelectQueryBuilder;
    orWhere(
        columnOrConditions: string | WhereClause, 
        operator?: WhereOperator, 
        value?: any, 
        value2?: any
    ): SelectQueryBuilder {
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

    orWhereRaw(sql: string, params: any[] = []): SelectQueryBuilder {
        this.whereConditions.push(`OR ${sql}`);
        this.whereParams.push(...params);
        return this;
    }

    orderBy(columns: string | string[]): SelectQueryBuilder {
        const cols = Array.isArray(columns) ? columns.join(", ") : columns;
        this.orderByClause = `ORDER BY ${cols}`;
        return this;
    }

    groupBy(columns: string | string[]): SelectQueryBuilder {
        const cols = Array.isArray(columns) ? columns.join(", ") : columns;
        this.groupByClause = `GROUP BY ${cols}`;
        return this;
    }

    having(conditions: WhereClause): SelectQueryBuilder;
    having(column: string, operator: WhereOperator, value: any): SelectQueryBuilder;
    having(column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any): SelectQueryBuilder;
    having(column: string, operator: "IN" | "NOT IN", values: any[]): SelectQueryBuilder;
    having(
        columnOrConditions: string | WhereClause, 
        operator?: WhereOperator, 
        value?: any, 
        value2?: any
    ): SelectQueryBuilder {
        if (typeof columnOrConditions === "string") {
            // Explicit having condition: .having("COUNT(*)", ">", value)
            const column = columnOrConditions;
            const op = operator!;
            const val = value;
            
            if (op === "BETWEEN" || op === "NOT BETWEEN") {
                this.havingConditions.push(`"${column}" ${op} ? AND ?`);
                this.havingParams.push(val, value2);
            } else if (op === "IN" || op === "NOT IN") {
                const placeholders = (val as any[]).map(() => "?").join(", ");
                this.havingConditions.push(`"${column}" ${op} (${placeholders})`);
                this.havingParams.push(...(val as any[]));
            } else if (op === "IS NULL" || op === "IS NOT NULL") {
                this.havingConditions.push(`"${column}" ${op}`);
            } else {
                this.havingConditions.push(`"${column}" ${op} ?`);
                this.havingParams.push(val);
            }
        } else {
            // Object having condition: .having({ count: value })
            const havingClause = this.buildWhereClause(columnOrConditions);
            if (havingClause) {
                this.havingConditions.push(havingClause.clause);
                this.havingParams.push(...havingClause.params);
            }
        }
        return this;
    }

    limit(count: number): SelectQueryBuilder {
        this.limitClause = `LIMIT ${count}`;
        return this;
    }

    offset(count: number): SelectQueryBuilder {
        this.offsetClause = `OFFSET ${count}`;
        return this;
    }

    join(table: string, on: string): SelectQueryBuilder {
        this.joins.push(`JOIN ${table} ON ${on}`);
        return this;
    }

    leftJoin(table: string, on: string): SelectQueryBuilder {
        this.joins.push(`LEFT JOIN ${table} ON ${on}`);
        return this;
    }

    rightJoin(table: string, on: string): SelectQueryBuilder {
        this.joins.push(`RIGHT JOIN ${table} ON ${on}`);
        return this;
    }

    innerJoin(table: string, on: string): SelectQueryBuilder {
        this.joins.push(`INNER JOIN ${table} ON ${on}`);
        return this;
    }

    async execute<T = any>(): Promise<T[]> {
        this.buildSQL();
        return this.executeQuery<T[]>(this.sql, this.params);
    }

    async first<T = any>(): Promise<T | undefined> {
        this.limit(1);
        this.buildSQL();
        return this.executeSingle<T>(this.sql, this.params);
    }

    async count(): Promise<number> {
        const originalColumns = this.columns;
        this.columns = "COUNT(*) as count";
        this.buildSQL();
        const result = this.executeSingle<{ count: number }>(this.sql, this.params);
        this.columns = originalColumns;
        return result?.count || 0;
    }

    private buildSQL(): void {
        if (!this.table) {
            throw new Error("Table name is required. Use .from() to specify the table.");
        }

        const parts = [`SELECT ${this.columns}`, `FROM "${this.table}"`];
        
        if (this.joins.length > 0) {
            parts.push(...this.joins);
        }
        
        if (this.whereConditions.length > 0) {
            // Join conditions with proper AND/OR logic
            const whereClause = this.whereConditions.join(" ");
            parts.push(`WHERE ${whereClause}`);
        }
        
        if (this.groupByClause) {
            parts.push(this.groupByClause);
        }
        
        if (this.havingConditions.length > 0) {
            parts.push(`HAVING ${this.havingConditions.join(" AND ")}`);
        }
        
        if (this.orderByClause) {
            parts.push(this.orderByClause);
        }
        
        if (this.limitClause) {
            parts.push(this.limitClause);
        }
        
        if (this.offsetClause) {
            parts.push(this.offsetClause);
        }

        this.sql = parts.join(" ");
        this.params = [...this.whereParams, ...this.havingParams];
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
