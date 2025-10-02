/**
 * Type definitions for Bunely
 */

export type WhereClause = Record<string, any>;

export type WhereOperator = 
    | "=" 
    | "!=" 
    | "<>" 
    | "<" 
    | ">" 
    | "<=" 
    | ">=" 
    | "LIKE" 
    | "NOT LIKE" 
    | "IN" 
    | "NOT IN" 
    | "IS NULL" 
    | "IS NOT NULL" 
    | "BETWEEN" 
    | "NOT BETWEEN";
export type SelectOptions = { 
    limit?: number; 
    offset?: number; 
    orderBy?: string[] 
};

export type TransactionOptions = {
    immediate?: boolean;
    tries?: number;
    backoffMs?: number;
};

export type ColumnType = 
    | 'INTEGER' 
    | 'TEXT' 
    | 'REAL' 
    | 'BLOB' 
    | 'NUMERIC' 
    | 'BOOLEAN' 
    | 'DATETIME';

export type ColumnDefinition = {
    name: string;
    type: ColumnType;
    primaryKey?: boolean;
    autoIncrement?: boolean;
    notNull?: boolean;
    unique?: boolean;
    defaultValue?: any;
    check?: string;
};

export type ForeignKeyDefinition = {
    column: string;
    references: {
        table: string;
        column: string;
    };
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
};

export type IndexDefinition = {
    name: string;
    columns: string[];
    unique?: boolean;
    where?: string;
    sql?: string;
};

export type TableDefinition = {
    name: string;
    columns: ColumnDefinition[];
    foreignKeys?: ForeignKeyDefinition[];
    indexes?: IndexDefinition[];
    ifNotExists?: boolean;
};

export type QueryBuilder = {
    select: (columns?: string | string[]) => SelectQueryBuilder;
    insert: (table: string) => InsertQueryBuilder;
    update: (table: string) => UpdateQueryBuilder;
    delete: (table: string) => DeleteQueryBuilder;
    schema: SchemaBuilder;
    transaction: <T>(fn: (tx: any) => Promise<T> | T, options?: TransactionOptions) => Promise<T>;
};

export type SelectQueryBuilder = {
    from: (table: string) => SelectQueryBuilder;
    where: ((conditions: WhereClause) => SelectQueryBuilder) & 
           ((column: string, operator: WhereOperator, value: any) => SelectQueryBuilder) &
           ((column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any) => SelectQueryBuilder) &
           ((column: string, operator: "IN" | "NOT IN", values: any[]) => SelectQueryBuilder);
    whereRaw: (sql: string, params?: any[]) => SelectQueryBuilder;
    orWhere: ((conditions: WhereClause) => SelectQueryBuilder) & 
             ((column: string, operator: WhereOperator, value: any) => SelectQueryBuilder) &
             ((column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any) => SelectQueryBuilder) &
             ((column: string, operator: "IN" | "NOT IN", values: any[]) => SelectQueryBuilder);
    orWhereRaw: (sql: string, params?: any[]) => SelectQueryBuilder;
    orderBy: (columns: string | string[]) => SelectQueryBuilder;
    groupBy: (columns: string | string[]) => SelectQueryBuilder;
    having: ((conditions: WhereClause) => SelectQueryBuilder) & 
            ((column: string, operator: WhereOperator, value: any) => SelectQueryBuilder) &
            ((column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any) => SelectQueryBuilder) &
            ((column: string, operator: "IN" | "NOT IN", values: any[]) => SelectQueryBuilder);
    limit: (count: number) => SelectQueryBuilder;
    offset: (count: number) => SelectQueryBuilder;
    join: (table: string, on: string) => SelectQueryBuilder;
    leftJoin: (table: string, on: string) => SelectQueryBuilder;
    rightJoin: (table: string, on: string) => SelectQueryBuilder;
    innerJoin: (table: string, on: string) => SelectQueryBuilder;
    toSQL: () => { sql: string; params: any[] };
    execute: <T = any>() => Promise<T[]>;
    first: <T = any>() => Promise<T | undefined>;
    count: () => Promise<number>;
};

export type InsertQueryBuilder = {
    values: (data: Record<string, any> | Record<string, any>[]) => InsertQueryBuilder;
    returning: (columns: string | string[]) => InsertQueryBuilder;
    toSQL: () => { sql: string; params: any[] };
    execute: () => Promise<{ lastInsertRowid: number; changes: number }>;
};

export type UpdateQueryBuilder = {
    set: (data: Record<string, any>) => UpdateQueryBuilder;
    where: ((conditions: WhereClause) => UpdateQueryBuilder) & 
           ((column: string, operator: WhereOperator, value: any) => UpdateQueryBuilder) &
           ((column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any) => UpdateQueryBuilder) &
           ((column: string, operator: "IN" | "NOT IN", values: any[]) => UpdateQueryBuilder);
    whereRaw: (sql: string, params?: any[]) => UpdateQueryBuilder;
    orWhere: ((conditions: WhereClause) => UpdateQueryBuilder) & 
             ((column: string, operator: WhereOperator, value: any) => UpdateQueryBuilder) &
             ((column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any) => UpdateQueryBuilder) &
             ((column: string, operator: "IN" | "NOT IN", values: any[]) => UpdateQueryBuilder);
    orWhereRaw: (sql: string, params?: any[]) => UpdateQueryBuilder;
    returning: (columns: string | string[]) => UpdateQueryBuilder;
    toSQL: () => { sql: string; params: any[] };
    execute: () => Promise<{ changes: number }>;
};

export type DeleteQueryBuilder = {
    where: ((conditions: WhereClause) => DeleteQueryBuilder) & 
           ((column: string, operator: WhereOperator, value: any) => DeleteQueryBuilder) &
           ((column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any) => DeleteQueryBuilder) &
           ((column: string, operator: "IN" | "NOT IN", values: any[]) => DeleteQueryBuilder);
    whereRaw: (sql: string, params?: any[]) => DeleteQueryBuilder;
    orWhere: ((conditions: WhereClause) => DeleteQueryBuilder) & 
             ((column: string, operator: WhereOperator, value: any) => DeleteQueryBuilder) &
             ((column: string, operator: "BETWEEN" | "NOT BETWEEN", value1: any, value2: any) => DeleteQueryBuilder) &
             ((column: string, operator: "IN" | "NOT IN", values: any[]) => DeleteQueryBuilder);
    orWhereRaw: (sql: string, params?: any[]) => DeleteQueryBuilder;
    returning: (columns: string | string[]) => DeleteQueryBuilder;
    toSQL: () => { sql: string; params: any[] };
    execute: () => Promise<{ changes: number }>;
};

export type SchemaBuilder = {
    createTable: (name: string) => CreateTableBuilder;
    dropTable: (name: string) => DropTableBuilder;
    alterTable: (name: string) => AlterTableBuilder;
    createIndex: (name: string) => CreateIndexBuilder;
    dropIndex: (name: string) => DropIndexBuilder;
    renameTable: (oldName: string, newName: string) => Promise<void>;
    hasTable: (name: string) => Promise<boolean>;
    hasColumn: (table: string, column: string) => Promise<boolean>;
    getTableInfo: (name: string) => Promise<ColumnDefinition[]>;
    getForeignKeys: (name: string) => Promise<ForeignKeyDefinition[]>;
    getIndexes: (name: string) => Promise<IndexDefinition[]>;
};

export type CreateTableBuilder = {
    addColumn: (column: ColumnDefinition) => CreateTableBuilder;
    addForeignKey: (fk: ForeignKeyDefinition) => CreateTableBuilder;
    addIndex: (index: IndexDefinition) => CreateTableBuilder;
    ifNotExists: (value?: boolean) => CreateTableBuilder;
    toSQL: () => string;
    execute: () => Promise<void>;
};

export type DropTableBuilder = {
    ifExists: (value?: boolean) => DropTableBuilder;
    toSQL: () => string;
    execute: () => Promise<void>;
};

export type AlterTableBuilder = {
    addColumn: (column: ColumnDefinition) => AlterTableBuilder;
    dropColumn: (column: string) => AlterTableBuilder;
    renameColumn: (oldName: string, newName: string) => AlterTableBuilder;
    alterColumn: (columnName: string, callback: (column: ColumnDefinition) => ColumnDefinition) => AlterTableBuilder;
    addForeignKey: (fk: ForeignKeyDefinition) => AlterTableBuilder;
    dropForeignKey: (column: string) => AlterTableBuilder;
    addIndex: (index: IndexDefinition) => AlterTableBuilder;
    dropIndex: (indexName: string) => AlterTableBuilder;
    makeColumnsUnique: (columns: string[], unique?: boolean) => AlterTableBuilder;
    toSQL: () => string[];
    execute: () => Promise<void>;
};

export type CreateIndexBuilder = {
    on: (table: string) => CreateIndexBuilder;
    columns: (cols: string[]) => CreateIndexBuilder;
    unique: (value?: boolean) => CreateIndexBuilder;
    where: (condition: string) => CreateIndexBuilder;
    ifNotExists: (value?: boolean) => CreateIndexBuilder;
    toSQL: () => string;
    execute: () => Promise<void>;
};

export type DropIndexBuilder = {
    ifExists: (value?: boolean) => DropIndexBuilder;
    toSQL: () => string;
    execute: () => Promise<void>;
};
