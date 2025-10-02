/**
 * ALTER TABLE query builder
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import type { AlterTableBuilder as IAlterTableBuilder, ColumnDefinition, ForeignKeyDefinition, IndexDefinition } from "../types";

export class AlterTableBuilder implements IAlterTableBuilder {
    private db: SQLiteDatabase;
    private name: string;
    private operations: string[] = [];
    private columnAlterations: Map<string, (column: ColumnDefinition) => ColumnDefinition> = new Map();
    private isTransaction: boolean = false;

    constructor(db: SQLiteDatabase, name: string, isTransaction: boolean = false) {
        this.db = db;
        this.name = name;
        this.isTransaction = isTransaction;
    }

    addColumn(column: ColumnDefinition): AlterTableBuilder {
        const definition = this.buildColumnDefinition(column);
        this.operations.push(`ADD COLUMN ${definition}`);
        // Also store the column definition for table recreation scenarios
        this.operations.push(`ADD_COLUMN_DEF:${JSON.stringify(column)}`);
        return this;
    }

    dropColumn(column: string): AlterTableBuilder {
        this.operations.push(`DROP_COLUMN:${column}`);
        return this;
    }

    renameColumn(oldName: string, newName: string): AlterTableBuilder {
        this.operations.push(`RENAME COLUMN "${oldName}" TO "${newName}"`);
        return this;
    }

    alterColumn(columnName: string, callback: (column: ColumnDefinition) => ColumnDefinition): AlterTableBuilder {
        // Store the callback function for later use
        this.columnAlterations.set(columnName, callback);
        this.operations.push(`ALTER_COLUMN:${columnName}`);
        return this;
    }

    addForeignKey(fk: ForeignKeyDefinition): AlterTableBuilder {
        // For foreign keys, we need to recreate the table
        // This will be handled in execute() method
        this.operations.push(`ADD_FOREIGN_KEY:${JSON.stringify(fk)}`);
        return this;
    }

    dropForeignKey(column: string): AlterTableBuilder {
        // For dropping foreign keys, we need to recreate the table
        // This will be handled in execute() method
        this.operations.push(`DROP_FOREIGN_KEY:${column}`);
        return this;
    }

    addIndex(index: IndexDefinition): AlterTableBuilder {
        // For indexes, we can use CREATE INDEX directly
        const uniqueClause = index.unique ? "UNIQUE" : "";
        const whereClause = index.where ? ` WHERE ${index.where}` : "";
        const columnList = index.columns.map(col => `"${col}"`).join(", ");

        this.operations.push(`CREATE ${uniqueClause} INDEX "${index.name}" ON "${this.name}" (${columnList})${whereClause}`);
        return this;
    }

    dropIndex(indexName: string): AlterTableBuilder {
        // For dropping indexes, we can use DROP INDEX directly
        this.operations.push(`DROP INDEX "${indexName}"`);
        return this;
    }

    makeColumnsUnique(columns: string[], unique: boolean = true): AlterTableBuilder {
        const columnList = columns.map(col => `"${col}"`).join(", ");
        
        if (unique) {
            // Create unique index with random suffix to avoid conflicts
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const indexName = `idx_${this.name}_${columns.join('_')}_unique_${timestamp}_${randomSuffix}`;
            const uniqueClause = "UNIQUE";
            this.operations.push(`CREATE ${uniqueClause} INDEX "${indexName}" ON "${this.name}" (${columnList})`);
        } else {
            // When unique=false, we need to drop any existing unique indexes on these columns
            // Use a special operation that will be handled in execute() to find and drop by columns
            this.operations.push(`DROP_INDEX_BY_COLUMNS:${JSON.stringify({ columns, unique: true })}`);
        }
        
        return this;
    }

    toSQL(): string[] {
        const sqls: string[] = [];

        for (const operation of this.operations) {
            if (operation.startsWith('ADD_FOREIGN_KEY:') || operation.startsWith('DROP_FOREIGN_KEY:') || operation.startsWith('ALTER_COLUMN:')) {
                // These operations require table recreation - handled in execute()
                continue;
            } else if (operation.startsWith('CREATE ') || operation.startsWith('DROP INDEX')) {
                // Index operations are standalone SQL statements
                sqls.push(operation);
            } else {
                // Regular ALTER TABLE operations
                sqls.push(`ALTER TABLE "${this.name}" ${operation}`);
            }
        }

        return sqls;
    }

    async execute(): Promise<void> {
        const tableRecreationOps = this.operations.filter(op =>
            op.startsWith('ADD_FOREIGN_KEY:') || op.startsWith('DROP_FOREIGN_KEY:') || op.startsWith('ALTER_COLUMN:') || op.startsWith('DROP_COLUMN:') || op.startsWith('ADD_COLUMN_DEF:')
        );

        const otherOps = this.operations.filter(op =>
            !op.startsWith('ADD_FOREIGN_KEY:') && !op.startsWith('DROP_FOREIGN_KEY:') && !op.startsWith('ALTER_COLUMN:') && !op.startsWith('DROP_COLUMN:') && !op.startsWith('ADD_COLUMN_DEF:') && !op.startsWith('ADD COLUMN')
        );

        // Handle operations that require table recreation
        if (tableRecreationOps.length > 0) {
            await this.handleTableRecreationOperations(tableRecreationOps);
            // Clear column alterations after processing
            this.columnAlterations.clear();
        }

        // Handle other operations (indexes, columns, etc.)
        for (const operation of otherOps) {
            if (operation.startsWith('CREATE ') || operation.startsWith('DROP INDEX')) {
                // Index operations are standalone SQL statements
                this.db.exec(operation);
            } else if (operation.startsWith('DROP_INDEX_BY_COLUMNS:')) {
                // Handle dropping indexes by columns
                const data = JSON.parse(operation.substring('DROP_INDEX_BY_COLUMNS:'.length));
                await this.dropIndexByColumns(data.columns, data.unique);
            } else if (operation.startsWith('ADD_COLUMN_DEF:') || operation.startsWith('ADD_FOREIGN_KEY:') || operation.startsWith('DROP_FOREIGN_KEY:') || operation.startsWith('DROP_COLUMN:') || operation.startsWith('ALTER_COLUMN:')) {
                // Skip internal operations that are handled in table recreation
                continue;
            } else {
                // Regular ALTER TABLE operations
                this.db.exec(`ALTER TABLE "${this.name}" ${operation}`);
            }
        }
    }

    private parseDefaultValue(dflt_value: any): any {
        if (dflt_value === null || dflt_value === undefined) {
            return dflt_value;
        }
        
        // SQLite returns "null" as a string when DEFAULT NULL is used
        if (dflt_value === "null") {
            return null;
        }
        
        // SQLite returns "true"/"false" as strings for boolean defaults
        if (dflt_value === "true") {
            return true;
        }
        if (dflt_value === "false") {
            return false;
        }
        
        // Try to parse numbers
        if (typeof dflt_value === "string" && !isNaN(Number(dflt_value))) {
            const num = Number(dflt_value);
            if (Number.isInteger(num)) {
                return num;
            } else {
                return num;
            }
        }
        
        return dflt_value;
    }

    private buildColumnDefinition(column: ColumnDefinition): string {
        let definition = `"${column.name}" ${column.type}`;

        if (column.primaryKey) {
            definition += " PRIMARY KEY";
        }

        if (column.autoIncrement) {
            definition += " AUTOINCREMENT";
        }

        if (column.notNull) {
            definition += " NOT NULL";
        }

        if (column.unique) {
            definition += " UNIQUE";
        }

        if (column.defaultValue !== undefined) {
            if (typeof column.defaultValue === 'string') {
                // Check if the string already has quotes (from SQLite PRAGMA)
                if (column.defaultValue.startsWith("'") && column.defaultValue.endsWith("'")) {
                    definition += ` DEFAULT ${column.defaultValue}`;
                } else {
                    definition += ` DEFAULT '${column.defaultValue}'`;
                }
            } else {
                definition += ` DEFAULT ${column.defaultValue}`;
            }
        }

        if (column.check) {
            definition += ` CHECK (${column.check})`;
        }

        return definition;
    }

    private async handleTableRecreationOperations(tableRecreationOps: string[]): Promise<void> {
        // Get current table structure
        const tableInfo = this.db.prepare(`PRAGMA table_info("${this.name}")`).all() as any[];
        const foreignKeys = this.db.prepare(`PRAGMA foreign_key_list("${this.name}")`).all() as any[];
        const indexes = this.db.prepare(
            `SELECT type, name, sql FROM sqlite_master WHERE type='index' AND tbl_name='${this.name}' AND name NOT LIKE 'sqlite_%'`
        ).all() as any[];

        // Get original CREATE TABLE statement to extract unique constraints
        const createTableStmt = this.db.prepare(
            `SELECT sql FROM sqlite_master WHERE type='table' AND name='${this.name}'`
        ).get() as { sql: string };

        // Extract unique constraints from the original CREATE TABLE statement
        const uniqueConstraints = this.extractUniqueConstraints(createTableStmt?.sql || '');

        // Also extract unique constraints from indexes (for cases where unique constraints were added as separate indexes)
        const uniqueConstraintsFromIndexes = this.extractUniqueConstraintsFromIndexes(indexes);

        // Merge both sets of unique constraints
        const allUniqueConstraints = new Set([...uniqueConstraints, ...uniqueConstraintsFromIndexes]);

        // Debug: Check what we're extracting vs what's actually in the database
        // console.log(`=== DEBUG INFO for table: ${this.name} ===`);
        // console.log(`Original CREATE TABLE SQL:`, createTableStmt?.sql);
        // console.log(`Extracted unique constraints from CREATE TABLE:`, Array.from(uniqueConstraints));
        // console.log(`Extracted unique constraints from indexes:`, Array.from(uniqueConstraintsFromIndexes));
        // console.log(`All unique constraints:`, Array.from(allUniqueConstraints));
        // console.log(`Table info from PRAGMA:`, tableInfo);
        // console.log(`Indexes found:`, indexes);

        // Check what unique constraints are actually in the database
        const actualUniqueIndexes = indexes.filter(idx => idx.sql && idx.sql.includes('UNIQUE'));
        // console.log(`Actual unique indexes in database:`, actualUniqueIndexes);

        // Check if there are any unique constraints that we missed
        const missedUniqueColumns = tableInfo.filter(col => {
            // Check if this column has a unique index
            const hasUniqueIndex = actualUniqueIndexes.some(idx =>
                idx.sql && idx.sql.includes(`"${col.name}"`)
            );
            // Only consider it missed if it's a single-column unique index
            const isSingleColumnIndex = actualUniqueIndexes.some(idx =>
                idx.sql && idx.sql.includes(`"${col.name}"`) && 
                idx.sql.match(/\([^)]+\)/)?.[1]?.split(',').length === 1
            );
            return hasUniqueIndex && !allUniqueConstraints.has(col.name) && isSingleColumnIndex;
        });

        if (missedUniqueColumns.length > 0) {
            console.log(`MISSED UNIQUE COLUMNS:`, missedUniqueColumns.map(col => col.name));
        }

        // console.log(`=== END DEBUG INFO ===`);

        // Parse operations
        const addFks: ForeignKeyDefinition[] = [];
        const dropFkColumns: string[] = [];
        const dropColumns: string[] = [];
        const addColumns: ColumnDefinition[] = [];

        for (const op of tableRecreationOps) {
            if (op.startsWith('ADD_FOREIGN_KEY:')) {
                const fkData = JSON.parse(op.substring('ADD_FOREIGN_KEY:'.length));
                addFks.push(fkData);
            } else if (op.startsWith('DROP_FOREIGN_KEY:')) {
                const column = op.substring('DROP_FOREIGN_KEY:'.length);
                dropFkColumns.push(column);
            } else if (op.startsWith('DROP_COLUMN:')) {
                const column = op.substring('DROP_COLUMN:'.length);
                dropColumns.push(column);
            } else if (op.startsWith('ADD_COLUMN_DEF:')) {
                const columnData = JSON.parse(op.substring('ADD_COLUMN_DEF:'.length));
                addColumns.push(columnData);
            }
            // Column alterations are handled via the stored callbacks
        }

        // Filter out foreign keys that are being dropped
        const filteredForeignKeys = foreignKeys.filter(fk => !dropFkColumns.includes(fk.from));

        // Filter out foreign keys that reference columns being dropped
        const finalFilteredForeignKeys = filteredForeignKeys.filter(fk => !dropColumns.includes(fk.from));

        // Add new foreign keys
        const allForeignKeys = [...finalFilteredForeignKeys, ...addFks];

        // Clean up foreign key references to ensure they point to the correct table names
        const cleanedForeignKeys = allForeignKeys.map(fk => {
            const cleanedFk = { ...fk };
            if (cleanedFk.table && cleanedFk.table.includes('_temp_')) {
                cleanedFk.table = cleanedFk.table.replace(/_temp_\d+$/, '');
            }
            if (cleanedFk.references && cleanedFk.references.table && cleanedFk.references.table.includes('_temp_')) {
                cleanedFk.references.table = cleanedFk.references.table.replace(/_temp_\d+$/, '');
            }
            return cleanedFk;
        });

        // Build new table definition
        let columns = tableInfo.map(col => ({
            name: col.name,
            type: col.type,
            primaryKey: col.pk === 1,
            notNull: col.notnull === 1,
            defaultValue: this.parseDefaultValue(col.dflt_value),
            unique: allUniqueConstraints.has(col.name) // Preserve existing unique constraints
        })) as ColumnDefinition[];

        // Filter out columns that are being dropped
        columns = columns.filter(col => !dropColumns.includes(col.name));

        // Add new columns
        columns = [...columns, ...addColumns];

        // Debug: Log the columns and foreign keys
        // console.log('=== DEBUG: Table Recreation ===');
        // console.log('Columns:', columns.map(c => ({ name: c.name, type: c.type })));
        // console.log('Foreign Keys:', cleanedForeignKeys);
        // console.log('Add Columns:', addColumns);

        // Apply column alterations
        columns = columns.map(col => {
            const alteration = this.columnAlterations.get(col.name)!;
            if (alteration) {
                return alteration(col);
            }
            return col;
        });

        // Check if we're already in a transaction
        if (!this.isTransaction) {
            this.db.exec("BEGIN TRANSACTION");
        }

        try {
            // Disable foreign key constraints
            this.db.exec("PRAGMA foreign_keys=OFF");

            // Rename existing table
            const tempTableName = `${this.name}_temp_${Date.now()}`;
            this.db.exec(`ALTER TABLE "${this.name}" RENAME TO "${tempTableName}"`);

            // Create new table WITHOUT foreign keys first
            const createTableSQL = this.buildCreateTableSQL(this.name, columns, []);
            this.db.exec(createTableSQL);

            // Copy data from old table to new table
            const columnNames = columns.map(col => `"${col.name}"`).join(", ");
            this.db.exec(`INSERT INTO "${this.name}" (${columnNames}) SELECT ${columnNames} FROM "${tempTableName}"`);

            // Drop old table (this will also drop the indexes associated with it)
            this.db.exec(`DROP TABLE "${tempTableName}"`);

            // If we have foreign keys, we need to recreate the table with them
            if (cleanedForeignKeys.length > 0) {
                // Create a second temp table to hold the data
                const secondTempTableName = `${this.name}_temp2_${Date.now()}`;
                this.db.exec(`ALTER TABLE "${this.name}" RENAME TO "${secondTempTableName}"`);

                // Create the final table with foreign keys
                const finalCreateTableSQL = this.buildCreateTableSQL(this.name, columns, cleanedForeignKeys);
                this.db.exec(finalCreateTableSQL);

                // Recreate indexes BEFORE copying data (important for self-referencing FKs)
                for (const index of indexes) {
                    if (index.sql) {
                        // The index SQL now points to the temp table, we need to update it to point to the new table
                        const newIndexSQL = index.sql.replace(new RegExp(`"${tempTableName}"`, 'g'), `"${this.name}"`);
                        this.db.exec(newIndexSQL);
                    }
                }

                // Copy data back AFTER indexes are created
                this.db.exec(`INSERT INTO "${this.name}" (${columnNames}) SELECT ${columnNames} FROM "${secondTempTableName}"`);

                // Drop the second temp table
                this.db.exec(`DROP TABLE "${secondTempTableName}"`);
            } else {
                // If no foreign keys, recreate indexes after data copying
                for (const index of indexes) {
                    if (index.sql) {
                        // The index SQL now points to the temp table, we need to update it to point to the new table
                        const newIndexSQL = index.sql.replace(new RegExp(`"${tempTableName}"`, 'g'), `"${this.name}"`);
                        this.db.exec(newIndexSQL);
                    }
                }
            }


            // Re-enable foreign key constraints
            this.db.exec("PRAGMA foreign_keys=ON");

            // Commit transaction only if we started it
            if (!this.isTransaction) {
                this.db.exec("COMMIT");
            }
        } catch (error) {
            // Rollback on error only if we started the transaction
            if (!this.isTransaction) {
                this.db.exec("ROLLBACK");
            }
            this.db.exec("PRAGMA foreign_keys=ON");
            throw error;
        }
    }

    private buildCreateTableSQL(tableName: string, columns: ColumnDefinition[], foreignKeys: any[]): string {
        const columnDefs = columns.map(col => this.buildColumnDefinition(col));
        const fkDefs = foreignKeys.map(fk => this.buildForeignKeyDefinition(fk));

        const allDefs = [...columnDefs, ...fkDefs].filter(def => def && def.trim() !== '');
        return `CREATE TABLE "${tableName}" (${allDefs.join(", ")})`;
    }

    private buildForeignKeyDefinition(fk: any): string {
        // Clean up table name in case it's a temporary table name
        let referencedTable = fk.referencedTable || fk.table || (fk.references && fk.references.table);
        if (referencedTable && referencedTable.includes('_temp_')) {
            // Extract the original table name by removing the temp suffix
            referencedTable = referencedTable.replace(/_temp_\d+$/, '');
        }

        let definition = `FOREIGN KEY ("${fk.column || fk.from}") REFERENCES "${referencedTable}"("${fk.referencedColumn || fk.to || (fk.references && fk.references.column)}")`;

        if (fk.onDelete || fk.on_delete) {
            definition += ` ON DELETE ${fk.onDelete || fk.on_delete}`;
        }

        if (fk.onUpdate || fk.on_update) {
            definition += ` ON UPDATE ${fk.onUpdate || fk.on_update}`;
        }

        return definition;
    }

    private extractUniqueConstraints(createTableSQL: string): Set<string> {
        const uniqueColumns = new Set<string>();

        if (!createTableSQL) return uniqueColumns;

        // Regex to find UNIQUE constraints in column definitions
        // This matches patterns like:
        // - "column_name TYPE UNIQUE"
        // - "column_name TYPE PRIMARY KEY UNIQUE"
        // - "column_name TYPE NOT NULL UNIQUE"
        // - "column_name TYPE PRIMARY KEY UNIQUE NOT NULL"
        // - "column_name TYPE NOT NULL PRIMARY KEY UNIQUE"
        const uniqueRegex = /"([^"]+)"\s+\w+(?:\s+(?:NOT\s+NULL|PRIMARY\s+KEY))*\s+UNIQUE/g;
        let match;

        while ((match = uniqueRegex.exec(createTableSQL)) !== null) {
            uniqueColumns.add(match[1]!);
        }

        return uniqueColumns;
    }

    private extractUniqueConstraintsFromIndexes(indexes: any[]): Set<string> {
        const uniqueColumns = new Set<string>();

        for (const index of indexes) {
            if (index.sql && index.sql.includes('UNIQUE')) {
                // Extract column names from the index SQL
                // Example: CREATE UNIQUE INDEX "idx_name" ON "table" ("column1", "column2")
                const match = index.sql.match(/\(([^)]+)\)/);
                if (match) {
                    const columns = match[1].split(',').map((col: string) =>
                        col.trim().replace(/"/g, '')
                    );
                    // Only add individual columns as unique if it's a single-column index
                    if (columns.length === 1) {
                        columns.forEach((col: string) => uniqueColumns.add(col));
                    }
                    // For composite indexes, we'll handle them separately in the index recreation
                }
            }
        }

        return uniqueColumns;
    }

    private isSingleColumnUnique(columnName: string, indexes: any[]): boolean {
        // Check if this column has a single-column unique index
        return indexes.some(idx => 
            idx.sql && 
            idx.sql.includes('UNIQUE') && 
            idx.sql.includes(`"${columnName}"`) &&
            idx.sql.match(/\([^)]+\)/)?.[1]?.split(',').length === 1
        );
    }

    private async dropIndexByColumns(columns: string[], unique: boolean): Promise<void> {
        // Get all indexes for this table
        const indexes = this.db.prepare(
            `SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='${this.name}' AND name NOT LIKE 'sqlite_%'`
        ).all() as any[];

        // Find indexes that match the specified columns and unique constraint
        const matchingIndexes = indexes.filter(idx => {
            if (!idx.sql) return false;
            
            // Check if it matches the unique constraint requirement
            const isUnique = idx.sql.includes('UNIQUE');
            if (unique && !isUnique) return false;
            if (!unique && isUnique) return false;
            
            // Extract columns from the index SQL
            const match = idx.sql.match(/\(([^)]+)\)/);
            if (!match) return false;
            
            const indexColumns = match[1].split(',').map((col: string) =>
                col.trim().replace(/"/g, '')
            );
            
            // Check if columns match (order doesn't matter)
            if (indexColumns.length !== columns.length) return false;
            
            const sortedIndexColumns = [...indexColumns].sort();
            const sortedTargetColumns = [...columns].sort();
            
            return sortedIndexColumns.every((col, i) => col === sortedTargetColumns[i]);
        });

        // Drop all matching indexes
        for (const index of matchingIndexes) {
            this.db.exec(`DROP INDEX "${index.name}"`);
        }
    }
}
