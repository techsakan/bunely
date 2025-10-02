/**
 * Bunely - A lightweight SQLite wrapper for Bun with transaction support
 * 
 * @fileoverview Provides a clean API for SQLite operations with nested transactions,
 * savepoints, and automatic retry logic for busy database scenarios.
 */

import { Database } from "bun:sqlite";

/**
 * Type definitions for query operations
 */
export type WhereClause = Record<string, any>;
export type SelectOptions = { 
    limit?: number; 
    offset?: number; 
    orderBy?: string[] 
};

/**
 * Transaction options for retry logic
 */
export type TransactionOptions = {
    immediate?: boolean;
    tries?: number;
    backoffMs?: number;
};

/**
 * Global counter for unique transaction names
 */
let transactionIdCounter = 0;

/**
 * Generates a unique name for transactions and savepoints
 */
const generateTransactionName = (): string => 
    `bunely_tx_${Date.now()}_${++transactionIdCounter}`;

/**
 * Mutex implementation for serializing database operations
 * Ensures only one transaction can modify the database at a time
 */
class Mutex {
    private promise: Promise<void> = Promise.resolve();

    /**
     * Executes a function with mutex protection
     * @param fn Function to execute
     * @returns Promise resolving to the function result
     */
    async run<T>(fn: () => Promise<T>): Promise<T> {
        let release!: () => void;
        const wait = new Promise<void>(resolve => (release = resolve));
        const previous = this.promise;
        this.promise = (async () => { 
            await previous; 
            await wait; 
        })();
        
        try { 
            return await fn(); 
        } finally { 
            release(); 
        }
    }
}

/**
 * Transaction class providing SQLite operations within a transaction context
 * Supports nested transactions via savepoints and provides a Knex-like API
 */
export class Tx {
    public isReleased = false;
    private savepointStack: string[] = [];

    constructor(
        private readonly db: Database, 
        private readonly savepointName: string
    ) {
        this.savepointStack.push(savepointName);
    }

    /**
     * Execute a SQL statement and return the result
     * @param sql SQL statement to execute
     * @param params Parameters for the SQL statement
     * @returns Result of the SQL execution
     */
    run(sql: string, params: any[] = []) {
        return this.db.prepare(sql).run(...params);
    }

    /**
     * Execute a SQL query and return the first row
     * @param sql SQL query to execute
     * @param params Parameters for the SQL query
     * @returns First row or undefined if no results
     */
    get<T = any>(sql: string, params: any[] = []): T | undefined {
        return this.db.prepare(sql).get(...params) as T | undefined;
    }

    /**
     * Execute a SQL query and return all rows
     * @param sql SQL query to execute
     * @param params Parameters for the SQL query
     * @returns Array of all rows
     */
    all<T = any>(sql: string, params: any[] = []): T[] {
        return this.db.prepare(sql).all(...params) as T[];
    }

    /**
     * Insert a row into a table
     * @param table Table name
     * @param row Object containing column values
     * @returns Result of the insert operation
     */
    insert(table: string, row: Record<string, any>) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => "?").join(", ");
        const quotedColumns = columns.map(col => `"${col}"`).join(", ");
        const sql = `INSERT INTO "${table}" (${quotedColumns}) VALUES (${placeholders})`;
        const values = columns.map(col => row[col]);
        return this.run(sql, values);
    }

    /**
     * Update rows in a table
     * @param table Table name
     * @param set Object containing column values to update
     * @param where Object containing WHERE conditions
     * @returns Result of the update operation
     */
    update(table: string, set: Record<string, any>, where: WhereClause) {
        const setColumns = Object.keys(set);
        const whereColumns = Object.keys(where);
        
        const setClause = setColumns.map(col => `"${col}" = ?`).join(", ");
        const whereClause = whereColumns.length 
            ? ` WHERE ${whereColumns.map(col => `"${col}" = ?`).join(" AND ")}`
            : "";
        
        const sql = `UPDATE "${table}" SET ${setClause}${whereClause}`;
        const params = [
            ...setColumns.map(col => set[col]),
            ...whereColumns.map(col => where[col])
        ];
        
        return this.run(sql, params);
    }

    /**
     * Delete rows from a table
     * @param table Table name
     * @param where Object containing WHERE conditions
     * @returns Result of the delete operation
     */
    delete(table: string, where: WhereClause) {
        const whereColumns = Object.keys(where);
        const whereClause = whereColumns.length 
            ? ` WHERE ${whereColumns.map(col => `"${col}" = ?`).join(" AND ")}`
            : "";
        
        const sql = `DELETE FROM "${table}"${whereClause}`;
        const params = whereColumns.map(col => where[col]);
        
        return this.run(sql, params);
    }

    /**
     * Select rows from a table with optional filtering and ordering
     * @param table Table name
     * @param where Object containing WHERE conditions
     * @param opts Additional options for the query
     * @returns Array of matching rows
     */
    select<T = any>(table: string, where: WhereClause = {}, opts: SelectOptions = {}): T[] {
        const whereColumns = Object.keys(where);
        const queryParts = [`SELECT * FROM "${table}"`];
        const params: any[] = [];

        if (whereColumns.length) {
            const whereClause = whereColumns.map(col => {
                params.push(where[col]);
                return `"${col}" = ?`;
            }).join(" AND ");
            queryParts.push(`WHERE ${whereClause}`);
        }

        if (opts.orderBy?.length) {
            queryParts.push(`ORDER BY ${opts.orderBy.join(", ")}`);
        }

        if (opts.limit != null) {
            queryParts.push(`LIMIT ${opts.limit}`);
        }

        if (opts.offset != null) {
            queryParts.push(`OFFSET ${opts.offset}`);
        }

        return this.all(queryParts.join(" "), params);
    }

    /**
     * Select the first row from a table
     * @param table Table name
     * @param where Object containing WHERE conditions
     * @returns First matching row or undefined
     */
    first<T = any>(table: string, where: WhereClause = {}): T | undefined {
        return this.select<T>(table, where, { limit: 1 })[0];
    }

    /**
     * Create a nested transaction using a savepoint
     * @param fn Function to execute within the nested transaction
     * @returns Promise resolving to the function result
     */
    async transaction<T>(fn: (tx: Tx) => Promise<T> | T): Promise<T> {
        const name = generateTransactionName();
        this.db.exec(`SAVEPOINT ${name}`);
        const innerTx = new Tx(this.db, name);
        innerTx.savepointStack = [...this.savepointStack, name];
        
        try {
            const result = await fn(innerTx);
            if (!innerTx.isReleased) {
                this.db.exec(`RELEASE ${name}`);
                innerTx.isReleased = true;
            }
            return result;
        } catch (error) {
            try { 
                this.db.exec(`ROLLBACK TO ${name}`); 
            } catch { 
                // Ignore rollback errors
            }
            try { 
                if (!innerTx.isReleased) {
                    this.db.exec(`RELEASE ${name}`); 
                    innerTx.isReleased = true;
                }
            } catch { 
                // Ignore release errors
            }
            throw error;
        }
    }

    /**
     * Create a snapshot that can be reverted
     * @returns Function to revert to the snapshot
     */
    snapshot(): () => void {
        const name = generateTransactionName();
        this.db.exec(`SAVEPOINT ${name}`);
        let isUsed = false;
        
        return () => {
            if (isUsed) return;
            isUsed = true;
            
            try { 
                this.db.exec(`ROLLBACK TO ${name}`); 
            } finally {
                try { 
                    this.db.exec(`RELEASE ${name}`); 
                } catch { 
                    // Ignore release errors
                }
            }
        };
    }
}

/**
 * Main Bunely class providing database operations with transaction support
 * Handles concurrent access through mutex and provides retry logic for busy databases
 */
export class Bunely {
    private readonly mutex = new Mutex();

    constructor(
        private readonly db: Database, 
        options?: { busyTimeoutMs?: number }
    ) {
        if (options?.busyTimeoutMs != null) {
            try { 
                this.db.exec(`PRAGMA busy_timeout=${options.busyTimeoutMs}`); 
            } catch { 
                // Ignore if PRAGMA fails
            }
        }
    }

    /**
     * Execute a transaction with optional retry logic
     * @param fn Function to execute within the transaction
     * @param options Transaction options including retry configuration
     * @returns Promise resolving to the function result
     */
    async transaction<T>(
        fn: (tx: Tx) => Promise<T> | T, 
        options?: TransactionOptions
    ): Promise<T> {
        const { immediate = true, tries = 1, backoffMs = 10 } = options || {};
        
        return this.mutex.run(async () => {
            for (let attempt = 0; attempt < tries; attempt++) {
                const name = generateTransactionName();
                try {
                    this.db.exec(`SAVEPOINT ${name}`);
                    const tx = new Tx(this.db, name);
                    
                    const result = await fn(tx);
                    
                    // Only release if not already released by nested transaction
                    if (!tx.isReleased) {
                        try {
                            this.db.exec(`RELEASE ${name}`);
                            tx.isReleased = true;
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
        }) as Promise<T>;
    }

    /**
     * Execute a SQL statement (convenience method for non-transactional operations)
     * @param sql SQL statement to execute
     * @param params Parameters for the SQL statement
     * @returns Result of the SQL execution
     */
    run(sql: string, params: any[] = []) {
        return this.db.prepare(sql).run(...params);
    }

    /**
     * Execute a SQL query and return the first row (convenience method)
     * @param sql SQL query to execute
     * @param params Parameters for the SQL query
     * @returns First row or undefined if no results
     */
    get<T = any>(sql: string, params: any[] = []) {
        return this.db.prepare(sql).get(...params) as T | undefined;
    }

    /**
     * Execute a SQL query and return all rows (convenience method)
     * @param sql SQL query to execute
     * @param params Parameters for the SQL query
     * @returns Array of all rows
     */
    all<T = any>(sql: string, params: any[] = []) {
        return this.db.prepare(sql).all(...params) as T[];
    }
}
