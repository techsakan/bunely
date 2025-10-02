/**
 * Base query builder class
 */

import { Database as SQLiteDatabase } from "bun:sqlite";

export abstract class BaseQueryBuilder {
    protected db: SQLiteDatabase;
    protected sql: string = "";
    protected params: any[] = [];

    constructor(db: SQLiteDatabase) {
        this.db = db;
    }

    /**
     * Execute the query
     */
    protected executeQuery<T = any>(sql: string, params: any[] = []): T {
        return this.db.prepare(sql).all(...params) as T;
    }

    /**
     * Execute a single row query
     */
    protected executeSingle<T = any>(sql: string, params: any[] = []): T | undefined {
        return this.db.prepare(sql).get(...params) as T | undefined;
    }

    /**
     * Execute a run query
     */
    protected executeRun(sql: string, params: any[] = []) {
        return this.db.prepare(sql).run(...params);
    }

    /**
     * Get the SQL and parameters
     */
    toSQL(): { sql: string; params: any[] } {
        // Build SQL if not already built
        if (!this.sql) {
            (this as any).buildSQL();
        }
        return { sql: this.sql, params: this.params };
    }

    /**
     * Reset the query
     */
    protected reset(): void {
        this.sql = "";
        this.params = [];
    }
}
