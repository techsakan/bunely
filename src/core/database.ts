/**
 * Core Database class with query builder and schema management
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import type { QueryBuilder, TransactionOptions, WhereClause, SelectOptions } from "../types";
import { SelectQueryBuilder } from "../query/select";
import { InsertQueryBuilder } from "../query/insert";
import { UpdateQueryBuilder } from "../query/update";
import { DeleteQueryBuilder } from "../query/delete";
import { SchemaBuilder } from "../schema/builder";
import { Mutex } from "./mutex";

/**
 * Main Bunely Database class with query builder API
 */
export class Database {
    private readonly db: SQLiteDatabase;
    private readonly mutex = new Mutex();
    public readonly isTransaction: boolean;


    /**
     * Query builder methods
     */
    select(columns?: string | string[]): SelectQueryBuilder {
        return new SelectQueryBuilder(this.db, columns);
    }

    insert(table: string): InsertQueryBuilder {
        return new InsertQueryBuilder(this.db, table);
    }

    update(table: string): UpdateQueryBuilder {
        return new UpdateQueryBuilder(this.db, table);
    }

    delete(table: string): DeleteQueryBuilder {
        return new DeleteQueryBuilder(this.db, table);
    }

    /**
     * Schema builder
     */
    public readonly schema: SchemaBuilder;

    constructor(
        db: SQLiteDatabase, 
        options?: { busyTimeoutMs?: number; isTransaction?: boolean }
    ) {
        this.db = db;
        this.isTransaction = options?.isTransaction || false;
        this.schema = new SchemaBuilder(db, this.isTransaction);
        
        if (options?.busyTimeoutMs != null) {
            try { 
                this.db.exec(`PRAGMA busy_timeout=${options.busyTimeoutMs}`); 
            } catch { 
                // Ignore if PRAGMA fails
            }
        }
    }

    /**
     * Transaction management
     */
    async transaction<T>(
        fn: (tx: Database) => Promise<T> | T, 
        options?: TransactionOptions
    ): Promise<T> {
        const { immediate = true, tries = 1, backoffMs = 10 } = options || {};
        
        return this.mutex.run(async () => {
            for (let attempt = 0; attempt < tries; attempt++) {
                const name = this.generateTransactionName();
                try {
                    this.db.exec(`SAVEPOINT ${name}`);
                    const tx = new Database(this.db, { isTransaction: true });
                    
                    const result = await fn(tx);
                    
                    if (!tx.isTransaction || !this.isTransaction) {
                        try {
                            this.db.exec(`RELEASE ${name}`);
                        } catch (e) {
                            // Ignore if savepoint was already released
                        }
                    }
                    return result;
                } catch (error: any) {
                    try { 
                        this.db.exec(`ROLLBACK TO ${name}`); 
                    } catch { 
                        // Ignore rollback errors
                    }
                    try { 
                        this.db.exec(`RELEASE ${name}`); 
                    } catch { 
                        // Ignore release errors
                    }

                    const errorMessage = String(error?.message || error);
                    const isBusyError = errorMessage.includes("SQLITE_BUSY") || 
                                      errorMessage.includes("database is locked");
                    
                    if (isBusyError && attempt + 1 < tries) {
                        const delay = backoffMs * (attempt + 1);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                    throw error;
                }
            }
            
            throw new Error("Transaction failed after all retries");
        });
    }

    /**
     * Raw SQL execution methods
     */
    run(sql: string, params: any[] = []) {
        return this.db.prepare(sql).run(...params);
    }

    get<T = any>(sql: string, params: any[] = []) {
        return this.db.prepare(sql).get(...params) as T | undefined;
    }

    all<T = any>(sql: string, params: any[] = []) {
        return this.db.prepare(sql).all(...params) as T[];
    }

    /**
     * Convenience methods for common operations
     */
    async find<T = any>(table: string, where: WhereClause = {}): Promise<T[]> {
        return this.select().from(table).where(where).execute<T>();
    }

    async findOne<T = any>(table: string, where: WhereClause = {}): Promise<T | undefined> {
        return this.select().from(table).where(where).first<T>();
    }

    async create(table: string, data: Record<string, any>) {
        return this.insert(table).values(data).execute();
    }

    async updateOne(table: string, data: Record<string, any>, where: WhereClause) {
        return this.update(table).set(data).where(where).execute();
    }

    async deleteOne(table: string, where: WhereClause) {
        return this.delete(table).where(where).execute();
    }

    /**
     * Utility methods
     */
    private generateTransactionName(): string {
        return `bunely_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Enable foreign key constraints
     */
    enableForeignKeys(): void {
        this.db.exec("PRAGMA foreign_keys = ON");
    }

    /**
     * Check if foreign keys are enabled
     */
    areForeignKeysEnabled(): boolean {
        const result = this.get<{ foreign_keys: number }>("PRAGMA foreign_keys");
        return result?.foreign_keys === 1;
    }

    /**
     * Close the database connection
     */
    close(): void {
        this.db.close();
    }
}
