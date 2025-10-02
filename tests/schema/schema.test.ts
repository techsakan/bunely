/**
 * Tests for the schema management functionality
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { createTestDatabase, cleanupTestDatabase } from "../setup";
import type { Bunely } from "../../src";

test("Schema Management", () => {
    let db: Bunely;

    beforeEach(() => {
        db = createTestDatabase();
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("Table Creation", () => {
        test("should create table with basic columns", async () => {
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true,
                    unique: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true,
                    unique: true
                })
                .addColumn({
                    name: "age",
                    type: "INTEGER"
                })
                .addColumn({
                    name: "created_at",
                    type: "DATETIME",
                    defaultValue: "CURRENT_TIMESTAMP"
                })
                .execute();

            // Verify table exists
            const hasTable = await db.schema.hasTable("users");
            expect(hasTable).toBe(true);

            // Verify table structure
            const columns = await db.schema.getTableInfo("users");
            expect(columns).toHaveLength(5);
            expect(columns[0]!.name).toBe("id");
            expect(columns[0]!.type).toBe("INTEGER");
            expect(columns[0]!.primaryKey).toBe(true);
            expect(columns[0]!.autoIncrement).toBe(true);
        });

        test("should create table with addColumn default value as null", async () => {
            await db.schema.createTable("products")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "description",
                    type: "TEXT",
                    defaultValue: null
                })
                .execute();

            // Verify table exists
            const hasTable = await db.schema.hasTable("products");
            expect(hasTable).toBe(true);

            // Verify table structure
            const columns = await db.schema.getTableInfo("products");
            expect(columns).toHaveLength(3);
            const descriptionColumn = columns.find((c: any) => c.name === "description");
            expect(descriptionColumn).toBeDefined();
            expect(descriptionColumn?.type).toBe("TEXT");
            expect(descriptionColumn?.defaultValue).toBe(null);
        });

        test("should create table with if not exists", async () => {
            await db.schema.createTable("users")
                .ifNotExists(true)
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .execute();

            // Try to create the same table again - should not throw
            await db.schema.createTable("users")
                .ifNotExists(true)
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .execute();

            const hasTable = await db.schema.hasTable("users");
            expect(hasTable).toBe(true);
        });

        test("should create table with foreign keys", async () => {
            // Create users table first
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Create posts table with foreign key
            await db.schema.createTable("posts")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "user_id",
                    type: "INTEGER",
                    notNull: true
                })
                .addColumn({
                    name: "title",
                    type: "TEXT",
                    notNull: true
                })
                .addForeignKey({
                    column: "user_id",
                    references: {
                        table: "users",
                        column: "id"
                    },
                    onDelete: "CASCADE"
                })
                .execute();

            // Verify foreign key exists
            const foreignKeys = await db.schema.getForeignKeys("posts");
            expect(foreignKeys).toHaveLength(1);
            expect(foreignKeys[0]!.column).toBe("user_id");
            expect(foreignKeys[0]!.references.table).toBe("users");
            expect(foreignKeys[0]!.references.column).toBe("id");
        });

        test("should create table with indexes", async () => {
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true,
                    unique: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .addIndex({
                    name: "idx_users_email",
                    columns: ["email"],
                    unique: true
                })
                .addIndex({
                    name: "idx_users_username",
                    columns: ["username"]
                })
                .execute();

            // Verify indexes exist
            const indexes = await db.schema.getIndexes("users");
            expect(indexes).toHaveLength(2);
            expect(indexes.find((i: any) => i.name === "idx_users_email")).toBeDefined();
            expect(indexes.find((i: any) => i.name === "idx_users_username")).toBeDefined();
        });

        test("should generate SQL for table creation", () => {
            const sql = db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true,
                    unique: true
                })
                .toSQL();

            expect(sql).toContain("CREATE TABLE users");
            expect(sql).toContain("id INTEGER PRIMARY KEY AUTOINCREMENT");
            expect(sql).toContain("username TEXT NOT NULL UNIQUE");
        });
    });

    test("Table Dropping", () => {
        beforeEach(async () => {
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .execute();
        });

        test("should drop table", async () => {
            await db.schema.dropTable("users").execute();

            const hasTable = await db.schema.hasTable("users");
            expect(hasTable).toBe(false);
        });

        test("should drop table with if exists", async () => {
            await db.schema.dropTable("users").ifExists(true).execute();

            // Try to drop non-existent table - should not throw
            await db.schema.dropTable("nonexistent").ifExists(true).execute();

            const hasTable = await db.schema.hasTable("users");
            expect(hasTable).toBe(false);
        });

        test("should generate SQL for table dropping", () => {
            const sql = db.schema.dropTable("users").ifExists(true).toSQL();
            expect(sql).toContain("DROP TABLE IF EXISTS users");
        });
    });

    test("Table Alteration", () => {
        beforeEach(async () => {
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .execute();
        });

        test("should add column to table", async () => {
            await db.schema.alterTable("users")
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true,
                    unique: true
                })
                .execute();

            const columns = await db.schema.getTableInfo("users");
            expect(columns).toHaveLength(3);
            expect(columns.find((c: any) => c.name === "email")).toBeDefined();
        });

        test("should add column with default value as null", async () => {
            await db.schema.alterTable("users")
                .addColumn({
                    name: "description",
                    type: "TEXT",
                    defaultValue: null
                })
                .execute();

            const columns = await db.schema.getTableInfo("users");
            expect(columns).toHaveLength(3);
            const descriptionColumn = columns.find((c: any) => c.name === "description");
            expect(descriptionColumn).toBeDefined();
            expect(descriptionColumn?.type).toBe("TEXT");
            expect(descriptionColumn?.defaultValue).toBe(null);
        });

        test("should preserve default value null when adding foreign key", async () => {
            // Create a second table for foreign key reference
            await db.schema.createTable("posts")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "title",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "user_id",
                    type: "INTEGER",
                    defaultValue: null
                })
                .execute();

            // Add foreign key (this triggers table recreation)
            await db.schema.alterTable("posts")
                .addForeignKey({
                    column: "user_id",
                    references: {
                        table: "users",
                        column: "id"
                    },
                    onDelete: "CASCADE"
                })
                .execute();

            // Verify that defaultValue: null is preserved after addForeignKey
            const columns = await db.schema.getTableInfo("posts");
            const user_idColumn = columns.find((c: any) => c.name === "user_id");
            expect(user_idColumn).toBeDefined();
            expect(user_idColumn?.type).toBe("INTEGER");
            expect(user_idColumn?.defaultValue).toBe(null);
        });

        test("should add composite unique constraint with alterTable", async () => {
            // Create a table with multiple columns
            await db.schema.createTable("products")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "category",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "sku",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "variant",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add composite unique constraint on category + sku
            await db.schema.alterTable("products")
                .addIndex({
                    name: "idx_products_category_sku",
                    columns: ["category", "sku"],
                    unique: true
                })
                .execute();

            // Add another composite unique constraint on sku + variant
            await db.schema.alterTable("products")
                .addIndex({
                    name: "idx_products_sku_variant",
                    columns: ["sku", "variant"],
                    unique: true
                })
                .execute();

            // Verify the indexes were created
            const indexes = await db.schema.getIndexes("products");
            expect(indexes).toHaveLength(2);

            const categorySkuIndex = indexes.find(idx => idx.name === "idx_products_category_sku");
            expect(categorySkuIndex).toBeDefined();
            expect(categorySkuIndex?.columns).toEqual(["category", "sku"]);
            expect(categorySkuIndex?.unique).toBe(true);

            const skuVariantIndex = indexes.find(idx => idx.name === "idx_products_sku_variant");
            expect(skuVariantIndex).toBeDefined();
            expect(skuVariantIndex?.columns).toEqual(["sku", "variant"]);
            expect(skuVariantIndex?.unique).toBe(true);
        });

        test("should migrate from single unique to composite unique constraint", async () => {
            // Step 1: Create table with column-level unique constraint
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true,
                    unique: true
                })
                .addColumn({
                    name: "department",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Insert test data
            await db.insert("users").values([
                { email: "john@company.com", department: "Engineering" },
                { email: "jane@company.com", department: "Marketing" }
            ]).execute();

            // Verify initial state
            const initialTableInfo = await db.schema.getTableInfo("users");
            const emailColumn = initialTableInfo.find(col => col.name === "email");
            expect(emailColumn?.unique).toBe(true);

            // Step 2: Migrate to composite unique constraint
            // This requires table recreation since column-level unique constraints
            // cannot be directly modified in SQLite
            await db.transaction(async (tx) => {
                // Backup current data
                const currentData = await tx.select().from("users").execute();

                // Drop the table
                await tx.schema.dropTable("users").execute();

                // Recreate without column-level unique
                await tx.schema.createTable("users")
                    .addColumn({
                        name: "id",
                        type: "INTEGER",
                        primaryKey: true
                    })
                    .addColumn({
                        name: "email",
                        type: "TEXT",
                        notNull: true
                        // No unique here - we'll add composite constraint
                    })
                    .addColumn({
                        name: "department",
                        type: "TEXT",
                        notNull: true
                    })
                    .execute();

                // Add composite unique constraint
                await tx.schema.alterTable("users")
                    .addIndex({
                        name: "idx_users_email_department",
                        columns: ["email", "department"],
                        unique: true
                    })
                    .execute();

                // Restore data
                await tx.insert("users").values(currentData).execute();
            });

            // Step 3: Verify the migration worked
            const finalIndexes = await db.schema.getIndexes("users");
            expect(finalIndexes).toHaveLength(1);

            const compositeIndex = finalIndexes.find(idx => idx.name === "idx_users_email_department");
            expect(compositeIndex).toBeDefined();
            expect(compositeIndex?.columns).toEqual(["email", "department"]);
            expect(compositeIndex?.unique).toBe(true);

            // Step 4: Test the new constraint behavior
            // This should work - same email, different department
            await db.insert("users").values([
                { email: "john@company.com", department: "Sales" }
            ]).execute();

            // This should fail - same email, same department
            await expect(
                db.insert("users").values([
                    { email: "john@company.com", department: "Engineering" }
                ]).execute()
            ).rejects.toThrow();

            // Verify final data
            const finalData = await db.select().from("users").execute();
            expect(finalData).toHaveLength(3); // Original 2 + 1 new
        });

        test("should drop column from table", async () => {
            await db.schema.alterTable("users")
                .dropColumn("username")
                .execute();

            const columns = await db.schema.getTableInfo("users");
            expect(columns).toHaveLength(1);
            expect(columns.find((c: any) => c.name === "username")).toBeUndefined();
        });

        test("should support OR conditions in queries", async () => {
            // Create a test table
            await db.schema.createTable("test_or")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "age",
                    type: "INTEGER"
                })
                .addColumn({
                    name: "department",
                    type: "TEXT"
                })
                .addColumn({
                    name: "status",
                    type: "TEXT"
                })
                .execute();

            // Insert test data
            await db.insert("test_or").values([
                { name: "John", age: 30, department: "Engineering", status: "active" },
                { name: "Jane", age: 25, department: "Marketing", status: "inactive" },
                { name: "Bob", age: 35, department: "Engineering", status: "active" },
                { name: "Alice", age: 28, department: "Sales", status: "active" },
                { name: "Charlie", age: 40, department: "Engineering", status: "pending" }
            ]).execute();

            // Test SELECT with OR
            const selectResult = await db.select().from("test_or")
                .where("department", "=", "Engineering")
                .orWhere("age", ">", 35)
                .execute();

            expect(selectResult).toHaveLength(3); // John, Bob, Charlie
            expect(selectResult.find(u => u.name === "John")).toBeDefined();
            expect(selectResult.find(u => u.name === "Bob")).toBeDefined();
            expect(selectResult.find(u => u.name === "Charlie")).toBeDefined();

            // Test UPDATE with OR
            const updateResult = await db.update("test_or")
                .set({ status: "updated" })
                .where("department", "=", "Marketing")
                .orWhere("age", "<", 30)
                .execute();

            expect(updateResult.changes).toBe(2); // Jane and Alice

            // Test DELETE with OR
            const deleteResult = await db.delete("test_or")
                .where("status", "=", "pending")
                .orWhere("age", ">", 38)
                .execute();

            expect(deleteResult.changes).toBe(1); // Charlie

            // Test orWhereRaw
            const rawResult = await db.select().from("test_or")
                .where("department", "=", "Engineering")
                .orWhereRaw("age > ? OR status = ?", [35, "updated"])
                .execute();

            expect(rawResult).toHaveLength(3); // John, Bob, Alice (updated)
        });

        test("should handle table names with spaces", async () => {
            // Create a table with spaces in the name
            await db.schema.createTable("zodula__Doctype Permission")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "role",
                    type: "TEXT"
                })
                .execute();

            // Insert test data
            await db.insert("zodula__Doctype Permission").values([
                { name: "Read", role: "user" },
                { name: "Write", role: "admin" },
                { name: "Delete", role: "admin" }
            ]).execute();

            // Test SELECT from table with spaces
            const result = await db.select().from("zodula__Doctype Permission").execute();
            expect(result).toHaveLength(3);
            expect(result.find(r => r.name === "Read")).toBeDefined();
            expect(result.find(r => r.name === "Write")).toBeDefined();
            expect(result.find(r => r.name === "Delete")).toBeDefined();

            // Test SELECT with WHERE clause
            const adminPermissions = await db.select().from("zodula__Doctype Permission")
                .where("role", "=", "admin")
                .execute();
            expect(adminPermissions).toHaveLength(2);

            // Test SELECT with OR conditions
            const userOrAdminPermissions = await db.select().from("zodula__Doctype Permission")
                .where("role", "=", "user")
                .orWhere("name", "=", "Write")
                .execute();
            expect(userOrAdminPermissions).toHaveLength(2);

            // Test UPDATE on table with spaces
            const updateResult = await db.update("zodula__Doctype Permission")
                .set({ role: "superuser" })
                .where("name", "=", "Delete")
                .execute();
            expect(updateResult.changes).toBe(1);

            // Test DELETE from table with spaces
            const deleteResult = await db.delete("zodula__Doctype Permission")
                .where("role", "=", "user")
                .execute();
            expect(deleteResult.changes).toBe(1);

            // Verify remaining data
            const remaining = await db.select().from("zodula__Doctype Permission").execute();
            expect(remaining).toHaveLength(2);
        });

        test("should handle dropping columns with foreign key constraints", async () => {
            // Create parent table
            await db.schema.createTable("categories")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Create child table with foreign key
            await db.schema.createTable("products")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "category_id",
                    type: "INTEGER"
                })
                .addForeignKey({
                    column: "category_id",
                    references: {
                        table: "categories",
                        column: "id"
                    }
                })
                .execute();

            // Insert test data
            await db.insert("categories").values([
                { id: 1, name: "Electronics" },
                { id: 2, name: "Books" }
            ]).execute();

            await db.insert("products").values([
                { id: 1, name: "Laptop", category_id: 1 },
                { id: 2, name: "Mouse", category_id: 1 },
                { id: 3, name: "Programming Book", category_id: 2 }
            ]).execute();

            // Verify foreign key constraint is working
            const productsWithCategories = await db.select().from("products").execute();
            expect(productsWithCategories).toHaveLength(3);

            // Test dropping the foreign key column
            await db.schema.alterTable("products")
                .dropColumn("category_id")
                .execute();

            // Verify column was dropped
            const tableInfo = await db.schema.getTableInfo("products");
            const categoryIdColumn = tableInfo.find((col: any) => col.name === "category_id");
            expect(categoryIdColumn).toBeUndefined();

            // Verify table still has other columns
            expect(tableInfo).toHaveLength(2); // id and name
            expect(tableInfo.find((col: any) => col.name === "id")).toBeDefined();
            expect(tableInfo.find((col: any) => col.name === "name")).toBeDefined();

            // Verify data is still accessible (without the foreign key column)
            const remainingProducts = await db.select().from("products").execute();
            expect(remainingProducts).toHaveLength(3);
            expect(remainingProducts[0]).toHaveProperty("name");
            expect(remainingProducts[0]).not.toHaveProperty("category_id");
        });

        test("should support toSQL() method for all query types", async () => {
            // Create test table
            await db.schema.createTable("test_sql")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "age",
                    type: "INTEGER"
                })
                .addColumn({
                    name: "department",
                    type: "TEXT"
                })
                .execute();

            // Insert test data
            await db.insert("test_sql").values([
                { name: "John", age: 30, department: "Engineering" },
                { name: "Jane", age: 25, department: "Marketing" },
                { name: "Bob", age: 35, department: "Engineering" }
            ]).execute();

            // Test SELECT toSQL()
            const selectQuery = db.select().from("test_sql")
                .where("department", "=", "Engineering")
                .orWhere("age", ">", 30)
                .orderBy("name")
                .limit(10);

            const selectSQL = selectQuery.toSQL();
            expect(selectSQL.sql).toContain('SELECT * FROM "test_sql"');
            expect(selectSQL.sql).toContain('WHERE "department" = ?');
            expect(selectSQL.sql).toContain('OR "age" > ?');
            expect(selectSQL.sql).toContain('ORDER BY name');
            expect(selectSQL.sql).toContain('LIMIT 10');
            expect(selectSQL.params).toEqual(["Engineering", 30]);

            // Test INSERT toSQL()
            const insertQuery = db.insert("test_sql")
                .values({ name: "Alice", age: 28, department: "Sales" })
                .returning(["id", "name"]);

            const insertSQL = insertQuery.toSQL();
            expect(insertSQL.sql).toContain('INSERT INTO "test_sql"');
            expect(insertSQL.sql).toContain('("name", "age", "department")');
            expect(insertSQL.sql).toContain('VALUES (?, ?, ?)');
            expect(insertSQL.sql).toContain('RETURNING "id", "name"');
            expect(insertSQL.params).toEqual(["Alice", 28, "Sales"]);

            // Test UPDATE toSQL()
            const updateQuery = db.update("test_sql")
                .set({ department: "Updated" })
                .where("age", "<", 30)
                .orWhere("name", "=", "Bob")
                .returning(["id", "name", "department"]);

            const updateSQL = updateQuery.toSQL();
            expect(updateSQL.sql).toContain('UPDATE "test_sql" SET "department" = ?');
            expect(updateSQL.sql).toContain('WHERE "age" < ?');
            expect(updateSQL.sql).toContain('OR "name" = ?');
            expect(updateSQL.sql).toContain('RETURNING "id", "name", "department"');
            expect(updateSQL.params).toEqual(["Updated", 30, "Bob"]);

            // Test DELETE toSQL()
            const deleteQuery = db.delete("test_sql")
                .where("department", "=", "Marketing")
                .orWhere("age", ">", 40)
                .returning(["id", "name"]);

            const deleteSQL = deleteQuery.toSQL();
            expect(deleteSQL.sql).toContain('DELETE FROM "test_sql"');
            expect(deleteSQL.sql).toContain('WHERE "department" = ?');
            expect(deleteSQL.sql).toContain('OR "age" > ?');
            expect(deleteSQL.sql).toContain('RETURNING "id", "name"');
            expect(deleteSQL.params).toEqual(["Marketing", 40]);

            // Test complex SELECT with joins and aggregations
            const complexSelectQuery = db.select(["name", "department", "COUNT(*) as count"])
                .from("test_sql")
                .where("age", ">", 25)
                .orWhere("department", "=", "Engineering")
                .groupBy("department")
                .having("COUNT(*)", ">", 1)
                .orderBy("count DESC")
                .limit(5);

            const complexSQL = complexSelectQuery.toSQL();
            expect(complexSQL.sql).toContain('SELECT name, department, COUNT(*) as count FROM "test_sql"');
            expect(complexSQL.sql).toContain('WHERE "age" > ?');
            expect(complexSQL.sql).toContain('OR "department" = ?');
            expect(complexSQL.sql).toContain('GROUP BY department');
            expect(complexSQL.sql).toContain('HAVING COUNT(*) > ?');
            expect(complexSQL.sql).toContain('ORDER BY count DESC');
            expect(complexSQL.sql).toContain('LIMIT 5');
            expect(complexSQL.params).toEqual([25, "Engineering", 1]);

            // Test that toSQL() doesn't modify the original query
            const originalQuery = db.select().from("test_sql").where("id", "=", 1);
            const sql1 = originalQuery.toSQL();
            const sql2 = originalQuery.toSQL();
            expect(sql1).toEqual(sql2);

            // Test that execute() still works after toSQL()
            const result = await originalQuery.execute();
            expect(result).toHaveLength(1);
            expect(result[0].name).toBe("John");
        });

        test("should support multiple WHERE clauses with chained .where() calls", async () => {
            // Create test table with spaces in name (like the user's example)
            await db.schema.createTable("zodula__Doctype Relative")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "parent_doctype",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "child_doctype",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "child_field_name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "status",
                    type: "TEXT"
                })
                .execute();

            // Insert test data
            await db.insert("zodula__Doctype Relative").values([
                {
                    parent_doctype: "User",
                    child_doctype: "Profile",
                    child_field_name: "user_id",
                    status: "active"
                },
                {
                    parent_doctype: "User",
                    child_doctype: "Profile",
                    child_field_name: "profile_id",
                    status: "inactive"
                },
                {
                    parent_doctype: "Product",
                    child_doctype: "Category",
                    child_field_name: "category_id",
                    status: "active"
                },
                {
                    parent_doctype: "User",
                    child_doctype: "Settings",
                    child_field_name: "user_id",
                    status: "pending"
                }
            ]).execute();

            // Test UPDATE with multiple WHERE clauses
            const updateResult = await db.update("zodula__Doctype Relative")
                .set({ status: "updated" })
                .where("parent_doctype", "=", "User")
                .where("child_doctype", "=", "Profile")
                .where("child_field_name", "=", "user_id")
                .execute();

            expect(updateResult.changes).toBe(1);

            // Test SELECT with multiple WHERE clauses
            const selectResult = await db.select().from("zodula__Doctype Relative")
                .where("parent_doctype", "=", "User")
                .where("child_doctype", "=", "Profile")
                .execute();

            expect(selectResult).toHaveLength(2);
            expect(selectResult.find(r => r.child_field_name === "user_id")?.status).toBe("updated");
            expect(selectResult.find(r => r.child_field_name === "profile_id")?.status).toBe("inactive");

            // Test DELETE with multiple WHERE clauses
            const deleteResult = await db.delete("zodula__Doctype Relative")
                .where("parent_doctype", "=", "Product")
                .where("child_doctype", "=", "Category")
                .where("child_field_name", "=", "category_id")
                .execute();

            expect(deleteResult.changes).toBe(1);

            // Test toSQL() with multiple WHERE clauses
            const updateQuery = db.update("zodula__Doctype Relative")
                .set({ status: "test" })
                .where("parent_doctype", "=", "User")
                .where("child_doctype", "=", "Settings")
                .where("child_field_name", "=", "user_id");

            const updateSQL = updateQuery.toSQL();
            expect(updateSQL.sql).toContain('UPDATE "zodula__Doctype Relative" SET "status" = ?');
            expect(updateSQL.sql).toContain('WHERE "parent_doctype" = ?');
            expect(updateSQL.sql).toContain('AND "child_doctype" = ?');
            expect(updateSQL.sql).toContain('AND "child_field_name" = ?');
            expect(updateSQL.params).toEqual(["test", "User", "Settings", "user_id"]);

            // Test mixed WHERE and OR WHERE clauses
            const mixedQuery = db.select().from("zodula__Doctype Relative")
                .where("parent_doctype", "=", "User")
                .where("child_doctype", "=", "Profile")
                .orWhere("status", "=", "pending")
                .execute();

            const mixedResult = await mixedQuery;
            expect(mixedResult).toHaveLength(3); // 2 Profile records + 1 pending record

            // Test complex scenario with object WHERE clauses
            const objectWhereQuery = db.select().from("zodula__Doctype Relative")
                .where({ parent_doctype: "User" })
                .where({ child_doctype: "Profile" })
                .orWhere({ status: "pending" });

            const objectWhereSQL = objectWhereQuery.toSQL();
            expect(objectWhereSQL.sql).toContain('WHERE "parent_doctype" = ?');
            expect(objectWhereSQL.sql).toContain('AND "child_doctype" = ?');
            expect(objectWhereSQL.sql).toContain('OR "status" = ?');
            expect(objectWhereSQL.params).toEqual(["User", "Profile", "pending"]);

            // Verify final data state
            const finalData = await db.select().from("zodula__Doctype Relative").execute();
            expect(finalData).toHaveLength(3);
        });

        test("should support table and column renaming", async () => {
            // Create test table
            await db.schema.createTable("original_table")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "description",
                    type: "TEXT"
                })
                .execute();

            // Insert test data
            await db.insert("original_table").values([
                { name: "Product A", description: "High quality product" },
                { name: "Product B", description: "Budget friendly option" }
            ]).execute();

            // Test table renaming
            await db.schema.renameTable("original_table", "renamed_table");

            // Verify table was renamed
            const hasOriginal = await db.schema.hasTable("original_table");
            const hasRenamed = await db.schema.hasTable("renamed_table");
            expect(hasOriginal).toBe(false);
            expect(hasRenamed).toBe(true);

            // Test column renaming on the renamed table
            await db.schema.alterTable("renamed_table")
                .renameColumn("description", "desc")
                .execute();

            // Verify column was renamed
            const tableInfo = await db.schema.getTableInfo("renamed_table");
            expect(tableInfo.find((col: any) => col.name === "description")).toBeUndefined();
            expect(tableInfo.find((col: any) => col.name === "desc")).toBeDefined();

            // Test querying the renamed table with renamed column
            const data = await db.select().from("renamed_table").execute();
            expect(data).toHaveLength(2);
            expect(data[0]).toHaveProperty("name");
            expect(data[0]).toHaveProperty("desc");
            expect(data[0]).not.toHaveProperty("description");

            // Test toSQL() for column renaming
            const renameSQL = db.schema.alterTable("renamed_table")
                .renameColumn("name", "product_name")
                .toSQL();

            expect(renameSQL).toContain('ALTER TABLE "renamed_table" RENAME COLUMN "name" TO "product_name"');
        });

        test("should properly handle composite unique indexes during addForeignKey table recreation", async () => {
            // Create a table with composite unique constraint
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "department",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add composite unique constraint
            await db.schema.alterTable("users")
                .addIndex({
                    name: "idx_users_username_department",
                    columns: ["username", "department"],
                    unique: true
                })
                .execute();

            // Insert test data
            await db.insert("users").values([
                { username: "john_doe", department: "Engineering" },
                { username: "jane_smith", department: "Marketing" },
                { username: "john_doe", department: "Marketing" } // This should be allowed (different department)
            ]).execute();

            // Create departments table
            await db.schema.createTable("departments")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            await db.insert("departments").values([
                { name: "Engineering" },
                { name: "Marketing" }
            ]).execute();

            // Add foreign key (this will trigger table recreation)
            await db.schema.alterTable("users")
                .addColumn({
                    name: "department_id",
                    type: "INTEGER"
                })
                .addForeignKey({
                    column: "department_id",
                    references: { table: "departments", column: "id" },
                    onDelete: "CASCADE"
                })
                .execute();

            // Test that composite unique constraint still works
            // This should fail (same username and department combination)
            try {
                await db.insert("users").values({
                    username: "john_doe",
                    department: "Marketing",
                    department_id: 2
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            // This should also fail (same username and department combination)
            try {
                await db.insert("users").values({
                    username: "jane_smith",
                    department: "Marketing",
                    department_id: 2
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            // This should work (different username and department combination)
            await db.insert("users").values({
                username: "alice_wonder",
                department: "Engineering",
                department_id: 1
            }).execute();

            // Verify the data
            const users = await db.select().from("users").execute();
            expect(users).toHaveLength(4); // Original 3 + new 1
        });

        test("should properly handle addForeignKey with onDelete and onUpdate options during table recreation", async () => {
            // Create a table with self-referencing foreign key
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add unique index on email
            await db.schema.alterTable("users")
                .addIndex({
                    name: "idx_users_email_unique",
                    columns: ["email"],
                    unique: true
                })
                .execute();

            // Insert test data
            await db.insert("users").values([
                { name: "John Doe", email: "john@example.com" },
                { name: "Jane Smith", email: "jane@example.com" },
                { name: "Bob Johnson", email: "bob@example.com" }
            ]).execute();

            console.log("Inserted initial data");

            // Add self-referencing foreign key with onDelete and onUpdate
            await db.schema.alterTable("users")
                .addColumn({
                    name: "created_by",
                    type: "INTEGER"
                })
                .addForeignKey({
                    column: "created_by",
                    references: { table: "users", column: "id" },
                    onDelete: "SET NULL",
                    onUpdate: "CASCADE"
                })
                .execute();

            console.log("Added self-referencing foreign key with onDelete and onUpdate");

            // Add another foreign key with different options
            await db.schema.alterTable("users")
                .addColumn({
                    name: "updated_by",
                    type: "INTEGER"
                })
                .addForeignKey({
                    column: "updated_by",
                    references: { table: "users", column: "id" },
                    onDelete: "CASCADE",
                    onUpdate: "RESTRICT"
                })
                .execute();

            console.log("Added second foreign key with different onDelete and onUpdate");

            // Verify foreign keys are created correctly
            const foreignKeys = await db.schema.getForeignKeys("users");
            expect(foreignKeys).toHaveLength(2);

            const createdByFk = foreignKeys.find(fk => fk.column === "created_by");
            expect(createdByFk).toBeDefined();
            expect(createdByFk!.references.table).toBe("users");
            expect(createdByFk!.references.column).toBe("id");
            expect(createdByFk!.onDelete).toBe("SET NULL");
            expect(createdByFk!.onUpdate).toBe("CASCADE");

            const updatedByFk = foreignKeys.find(fk => fk.column === "updated_by");
            expect(updatedByFk).toBeDefined();
            expect(updatedByFk!.references.table).toBe("users");
            expect(updatedByFk!.references.column).toBe("id");
            expect(updatedByFk!.onDelete).toBe("CASCADE");
            expect(updatedByFk!.onUpdate).toBe("RESTRICT");

            // Verify indexes are preserved
            const indexes = await db.schema.getIndexes("users");
            const emailIndex = indexes.find(idx => idx.name === "idx_users_email_unique");
            expect(emailIndex).toBeDefined();
            expect(emailIndex!.unique).toBe(true);
            expect(emailIndex!.columns).toEqual(["email"]);

            // Test foreign key constraints work
            // Update some users to have created_by references
            await db.update("users")
                .set({ created_by: 1 })
                .where("id", "=", 2)
                .execute();

            await db.update("users")
                .set({ created_by: 1 })
                .where("id", "=", 3)
                .execute();

            // Verify the data
            const users = await db.select().from("users").execute();
            expect(users).toHaveLength(3);

            const user2 = users.find(u => u.id === 2);
            const user3 = users.find(u => u.id === 3);
            expect(user2!.created_by).toBe(1);
            expect(user3!.created_by).toBe(1);

            // Test onDelete SET NULL by deleting the referenced user
            await db.delete("users").where("id", "=", 1).execute();

            // Check that created_by was set to NULL for users 2 and 3
            const remainingUsers = await db.select().from("users").execute();
            expect(remainingUsers).toHaveLength(2);
            expect(remainingUsers.every(u => u.created_by === null)).toBe(true);

            console.log("✅ All foreign key constraints and options work correctly");
        });

        test("should handle multiple foreign key options and edge cases during table recreation", async () => {
            // Create parent table
            await db.schema.createTable("categories")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Create child table
            await db.schema.createTable("products")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "price",
                    type: "REAL",
                    notNull: true
                })
                .execute();

            // Insert test data
            await db.insert("categories").values([
                { name: "Electronics" },
                { name: "Books" },
                { name: "Clothing" }
            ]).execute();

            await db.insert("products").values([
                { name: "Laptop", price: 999.99 },
                { name: "Book", price: 19.99 },
                { name: "Shirt", price: 29.99 }
            ]).execute();

            // Add foreign key with CASCADE onDelete
            await db.schema.alterTable("products")
                .addColumn({
                    name: "category_id",
                    type: "INTEGER"
                })
                .addForeignKey({
                    column: "category_id",
                    references: { table: "categories", column: "id" },
                    onDelete: "CASCADE",
                    onUpdate: "CASCADE"
                })
                .execute();

            // Add self-referencing foreign key with SET NULL
            await db.schema.alterTable("products")
                .addColumn({
                    name: "parent_product_id",
                    type: "INTEGER"
                })
                .addForeignKey({
                    column: "parent_product_id",
                    references: { table: "products", column: "id" },
                    onDelete: "SET NULL",
                    onUpdate: "RESTRICT"
                })
                .execute();

            // Add another foreign key with NO ACTION
            await db.schema.alterTable("products")
                .addColumn({
                    name: "created_by_user_id",
                    type: "INTEGER"
                })
                .addForeignKey({
                    column: "created_by_user_id",
                    references: { table: "categories", column: "id" },
                    onDelete: "NO ACTION",
                    onUpdate: "NO ACTION"
                })
                .execute();

            // Verify all foreign keys are created
            const foreignKeys = await db.schema.getForeignKeys("products");
            expect(foreignKeys).toHaveLength(3);

            // Test CASCADE behavior
            const categoryFk = foreignKeys.find(fk => fk.column === "category_id");
            expect(categoryFk!.onDelete).toBe("CASCADE");
            expect(categoryFk!.onUpdate).toBe("CASCADE");

            // Test SET NULL behavior
            const parentFk = foreignKeys.find(fk => fk.column === "parent_product_id");
            expect(parentFk!.onDelete).toBe("SET NULL");
            expect(parentFk!.onUpdate).toBe("RESTRICT");

            // Test NO ACTION behavior
            const userFk = foreignKeys.find(fk => fk.column === "created_by_user_id");
            expect(userFk!.onDelete).toBe("NO ACTION");
            expect(userFk!.onUpdate).toBe("NO ACTION");

            // Test that foreign key constraints actually work
            // Update products to reference categories
            await db.update("products")
                .set({ category_id: 1 })
                .where("id", "=", 1)
                .execute();

            await db.update("products")
                .set({ category_id: 2 })
                .where("id", "=", 2)
                .execute();

            await db.update("products")
                .set({ category_id: 3 })
                .where("id", "=", 3)
                .execute();

            // Test CASCADE delete
            await db.delete("categories").where("id", "=", 1).execute();

            // Check that the product with category_id=1 was also deleted (CASCADE)
            const remainingProducts = await db.select().from("products").execute();
            expect(remainingProducts).toHaveLength(2);

            // Test SET NULL with self-referencing FK
            await db.update("products")
                .set({ parent_product_id: 2 })
                .where("id", "=", 3)
                .execute();

            // Delete the parent product
            await db.delete("products").where("id", "=", 2).execute();

            // Check that parent_product_id was set to NULL (SET NULL)
            const finalProducts = await db.select().from("products").execute();
            expect(finalProducts).toHaveLength(1);
            expect(finalProducts[0].parent_product_id).toBe(null);

            console.log("✅ All foreign key options and behaviors work correctly");
        });

        test("should support makeColumnsUnique for single column unique constraint", async () => {
            // Create a table with a unique column
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add initial unique constraint on email
            await db.schema.alterTable("users")
                .addIndex({
                    name: "idx_users_email_unique",
                    columns: ["email"],
                    unique: true
                })
                .execute();

            // Insert test data
            await db.insert("users").values([
                { email: "john@example.com", username: "john" },
                { email: "jane@example.com", username: "jane" }
            ]).execute();

            // Use makeColumnsUnique to change from email to username
            await db.schema.alterTable("users")
                .makeColumnsUnique(["username"])
                .execute();

            // Verify the old unique constraint is removed and new one is created
            const indexes = await db.schema.getIndexes("users");
            const uniqueIndexes = indexes.filter(idx => idx.unique);

            expect(uniqueIndexes).toHaveLength(1);
            expect(uniqueIndexes[0]!.columns).toEqual(["username"]);

            // Test that the new unique constraint works
            // This should work (different username)
            await db.insert("users").values({
                email: "bob@example.com",
                username: "bob"
            }).execute();

            // This should fail (duplicate username)
            try {
                await db.insert("users").values({
                    email: "alice@example.com",
                    username: "john" // Duplicate username
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            // This should work (duplicate email is now allowed)
            await db.insert("users").values({
                email: "john@example.com", // Duplicate email is now allowed
                username: "alice"
            }).execute();

            console.log("✅ Single column makeColumnsUnique works correctly");
        });

        test("should support makeColumnsUnique for composite unique constraint", async () => {
            // Create a table
            await db.schema.createTable("products")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "category",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "brand",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add initial unique constraint on name only
            await db.schema.alterTable("products")
                .addIndex({
                    name: "idx_products_name_unique",
                    columns: ["name"],
                    unique: true
                })
                .execute();

            // Insert test data
            await db.insert("products").values([
                { name: "Laptop", category: "Electronics", brand: "Dell" },
                { name: "Book", category: "Education", brand: "Penguin" }
            ]).execute();

            // Use makeColumnsUnique to create composite unique constraint
            await db.schema.alterTable("products")
                .makeColumnsUnique(["category", "brand"])
                .execute();

            // Verify the old unique constraint is removed and new composite one is created
            const indexes = await db.schema.getIndexes("products");
            const uniqueIndexes = indexes.filter(idx => idx.unique);

            expect(uniqueIndexes).toHaveLength(1);
            expect(uniqueIndexes[0]!.columns).toEqual(["category", "brand"]);

            // Test that the new composite unique constraint works
            // This should work (different category/brand combination)
            await db.insert("products").values({
                name: "Laptop", // Duplicate name is now allowed
                category: "Electronics",
                brand: "HP" // Different brand
            }).execute();

            // This should work (different category/brand combination)
            await db.insert("products").values({
                name: "Book", // Duplicate name is now allowed
                category: "Fiction",
                brand: "Penguin" // Different category
            }).execute();

            // This should fail (duplicate category/brand combination)
            try {
                await db.insert("products").values({
                    name: "Desktop",
                    category: "Electronics",
                    brand: "Dell" // Duplicate category/brand combination
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            console.log("✅ Composite makeColumnsUnique works correctly");
        });

        test("should support makeColumnsUnique with foreign key operations", async () => {
            // Create parent table
            await db.schema.createTable("categories")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Create child table
            await db.schema.createTable("products")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "category_id",
                    type: "INTEGER"
                })
                .execute();

            // Insert test data
            await db.insert("categories").values([
                { name: "Electronics" },
                { name: "Books" }
            ]).execute();

            await db.insert("products").values([
                { name: "Laptop", category_id: 1 },
                { name: "Book", category_id: 2 }
            ]).execute();

            // Add unique constraint on name
            await db.schema.alterTable("products")
                .addIndex({
                    name: "idx_products_name_unique",
                    columns: ["name"],
                    unique: true
                })
                .execute();

            // Use makeColumnsUnique and addForeignKey together
            await db.schema.alterTable("products")
                .makeColumnsUnique(["category_id", "name"])
                .addForeignKey({
                    column: "category_id",
                    references: { table: "categories", column: "id" },
                    onDelete: "CASCADE"
                })
                .execute();

            // Verify foreign key is created
            const foreignKeys = await db.schema.getForeignKeys("products");
            expect(foreignKeys).toHaveLength(1);
            expect(foreignKeys[0]!.column).toBe("category_id");
            expect(foreignKeys[0]!.references.table).toBe("categories");

            // Verify composite unique constraint is created
            const indexes = await db.schema.getIndexes("products");
            const uniqueIndexes = indexes.filter(idx => idx.unique);

            expect(uniqueIndexes).toHaveLength(1);
            expect(uniqueIndexes[0]!.columns).toEqual(["category_id", "name"]);

            // Test that both constraints work
            // This should work (different category_id/name combination)
            await db.insert("products").values({
                name: "Laptop", // Duplicate name is now allowed
                category_id: 2 // Different category
            }).execute();

            // This should fail (duplicate category_id/name combination)
            try {
                await db.insert("products").values({
                    name: "Laptop",
                    category_id: 1 // Duplicate category_id/name combination
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            // Test foreign key constraint
            try {
                await db.insert("products").values({
                    name: "Invalid",
                    category_id: 999 // Non-existent category
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("FOREIGN KEY constraint failed");
            }

            console.log("✅ makeColumnsUnique with foreign key operations works correctly");
        });

        test("should support makeColumnsUnique with unique=false to create non-unique index", async () => {
            // Create a table with multiple unique constraints
            await db.schema.createTable("products")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "sku",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "category",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "brand",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add initial unique constraint on name
            await db.schema.alterTable("products")
                .addIndex({
                    name: "idx_products_name_unique",
                    columns: ["name"],
                    unique: true
                })
                .execute();

            // Add another unique constraint on sku
            await db.schema.alterTable("products")
                .addIndex({
                    name: "idx_products_sku_unique",
                    columns: ["sku"],
                    unique: true
                })
                .execute();

            // Insert test data
            await db.insert("products").values([
                { name: "Laptop", sku: "LAP001", category: "Electronics", brand: "Dell" },
                { name: "Book", sku: "BOOK001", category: "Education", brand: "Penguin" }
            ]).execute();

            console.log("Created table with name and sku unique constraints");

            // Use makeColumnsUnique with unique=false to create non-unique index
            await db.schema.alterTable("products")
                .makeColumnsUnique(["category", "brand"], false)
                .execute();

            console.log("Added non-unique index on category and brand");

            // Verify unique constraints and non-unique index
            const indexes = await db.schema.getIndexes("products");
            const uniqueIndexes = indexes.filter(idx => idx.unique);
            const nonUniqueIndexes = indexes.filter(idx => !idx.unique);
            
            expect(uniqueIndexes).toHaveLength(2); // name and sku (original unique constraints)
            expect(nonUniqueIndexes).toHaveLength(1); // category+brand (new non-unique index)

            // Check that original unique constraints still exist
            const nameIndex = uniqueIndexes.find(idx => idx.columns.includes("name") && idx.columns.length === 1);
            const skuIndex = uniqueIndexes.find(idx => idx.columns.includes("sku") && idx.columns.length === 1);

            expect(nameIndex).toBeDefined();
            expect(skuIndex).toBeDefined();

            // Check that non-unique index was created
            const categoryBrandIndex = nonUniqueIndexes.find(idx => idx.columns.includes("category") && idx.columns.includes("brand"));
            expect(categoryBrandIndex).toBeDefined();

            // Test that unique constraints still work but non-unique index allows duplicates
            // This should work (different name, sku, category/brand)
            await db.insert("products").values({
                name: "Desktop",
                sku: "DESK001",
                category: "Electronics",
                brand: "HP"
            }).execute();

            // This should fail (duplicate name)
            try {
                await db.insert("products").values({
                    name: "Laptop", // Duplicate name
                    sku: "LAP002",
                    category: "Electronics",
                    brand: "HP"
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            // This should fail (duplicate sku)
            try {
                await db.insert("products").values({
                    name: "Tablet",
                    sku: "LAP001", // Duplicate sku
                    category: "Electronics",
                    brand: "HP"
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            // This should work (duplicate category/brand is allowed with non-unique index)
            await db.insert("products").values({
                name: "Monitor",
                sku: "MON001",
                category: "Electronics",
                brand: "Dell" // Duplicate category/brand combination is now allowed
            }).execute();

            console.log("✅ makeColumnsUnique with unique=false works correctly");
        });

        test("should support makeColumnsUnique with unique=true to create unique constraint", async () => {
            // Create a table with initial unique constraint
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "department",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add initial unique constraint on email
            await db.schema.alterTable("users")
                .addIndex({
                    name: "idx_users_email_unique",
                    columns: ["email"],
                    unique: true
                })
                .execute();

            // Insert test data
            await db.insert("users").values([
                { email: "john@example.com", username: "john", department: "Engineering" },
                { email: "jane@example.com", username: "jane", department: "Marketing" }
            ]).execute();

            console.log("Created table with email unique constraint");

            // Use makeColumnsUnique with unique=true (default behavior)
            await db.schema.alterTable("users")
                .makeColumnsUnique(["username", "department"], true)
                .execute();

            console.log("Created username+department unique constraint");

            // Verify only the new unique constraint exists
            const indexes = await db.schema.getIndexes("users");
            const uniqueIndexes = indexes.filter(idx => idx.unique);

            expect(uniqueIndexes).toHaveLength(1);
            expect(uniqueIndexes[0]!.columns).toEqual(["username", "department"]);

            // Test that the new constraint works and old constraint is gone
            // This should work (duplicate email is now allowed)
            await db.insert("users").values({
                email: "john@example.com", // Duplicate email is now allowed
                username: "bob",
                department: "Sales"
            }).execute();

            // This should fail (duplicate username/department)
            try {
                await db.insert("users").values({
                    email: "alice@example.com",
                    username: "john", // Duplicate username
                    department: "Engineering" // Duplicate department
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            console.log("✅ makeColumnsUnique with unique=true works correctly");
        });

        test("should support makeColumnsUnique with empty array to remove all unique constraints", async () => {
            // Create a table with unique constraints
            await db.schema.createTable("items")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "code",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add unique constraints
            await db.schema.alterTable("items")
                .addIndex({
                    name: "idx_items_name_unique",
                    columns: ["name"],
                    unique: true
                })
                .execute();

            await db.schema.alterTable("items")
                .addIndex({
                    name: "idx_items_code_unique",
                    columns: ["code"],
                    unique: true
                })
                .execute();

            // Insert test data
            await db.insert("items").values([
                { name: "Item 1", code: "CODE001" },
                { name: "Item 2", code: "CODE002" }
            ]).execute();

            console.log("Created table with name and code unique constraints");

            // Use makeColumnsUnique with empty array to remove all unique constraints
            await db.schema.alterTable("items")
                .makeColumnsUnique([], false)
                .execute();

            console.log("Removed all unique constraints");

            // Verify no unique constraints exist (except primary key)
            const indexes = await db.schema.getIndexes("items");
            const uniqueIndexes = indexes.filter(idx => idx.unique);

            expect(uniqueIndexes).toHaveLength(0);

            // Test that duplicates are now allowed
            await db.insert("items").values({
                name: "Item 1", // Duplicate name is now allowed
                code: "CODE001" // Duplicate code is now allowed
            }).execute();

            await db.insert("items").values({
                name: "Item 1", // Duplicate name is still allowed
                code: "CODE001" // Duplicate code is still allowed
            }).execute();

            // Verify we can insert duplicates
            const items = await db.select().from("items").execute();
            expect(items).toHaveLength(4); // Original 2 + 2 new duplicates

            console.log("✅ makeColumnsUnique with empty array removes all unique constraints");
        });

        test("should support multiple makeColumnsUnique calls in the same operation", async () => {
            // Create a table with initial unique constraint
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "department",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "role",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Add initial unique constraint on email
            await db.schema.alterTable("users")
                .addIndex({
                    name: "idx_users_email_unique",
                    columns: ["email"],
                    unique: true
                })
                .execute();

            // Insert test data
            await db.insert("users").values([
                { email: "john@example.com", username: "john", department: "Engineering", role: "developer" },
                { email: "jane@example.com", username: "jane", department: "Marketing", role: "manager" }
            ]).execute();

            console.log("Created table with email unique constraint");

            // Use multiple makeColumnsUnique calls in the same operation
            await db.schema.alterTable("users")
                .makeColumnsUnique(["username"], true) // First call: add username unique
                .makeColumnsUnique(["department", "role"], true) // Second call: add composite unique
                .makeColumnsUnique(["username", "department"], true) // Third call: replace all with composite unique
                .execute();

            console.log("Applied multiple makeColumnsUnique calls");

            // Verify only the last makeColumnsUnique operation is applied
            const indexes = await db.schema.getIndexes("users");
            const uniqueIndexes = indexes.filter(idx => idx.unique);
            
            expect(uniqueIndexes).toHaveLength(1);
            expect(uniqueIndexes[0]!.columns).toEqual(["username", "department"]);

            // Test that the final constraint works
            // This should work (different username/department combination)
            await db.insert("users").values({
                email: "bob@example.com", // Duplicate email is now allowed
                username: "bob",
                department: "Sales",
                role: "sales"
            }).execute();

            // This should fail (duplicate username/department)
            try {
                await db.insert("users").values({
                    email: "alice@example.com",
                    username: "john", // Duplicate username
                    department: "Engineering", // Duplicate department
                    role: "designer"
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            console.log("✅ Multiple makeColumnsUnique calls work correctly - last operation wins");
        });

        test("should support multiple makeColumnsUnique calls with different removeExisting values", async () => {
            // Create a table
            await db.schema.createTable("products")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "name",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "sku",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "category",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "brand",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Insert test data
            await db.insert("products").values([
                { name: "Laptop", sku: "LAP001", category: "Electronics", brand: "Dell" },
                { name: "Book", sku: "BOOK001", category: "Education", brand: "Penguin" }
            ]).execute();

            console.log("Created table with test data");

            // Use multiple makeColumnsUnique calls with different unique values
            await db.schema.alterTable("products")
                .makeColumnsUnique(["name"], true) // First: add name unique
                .makeColumnsUnique(["sku"], true) // Second: add sku unique
                .makeColumnsUnique(["category", "brand"], true) // Third: replace all with composite unique
                .execute();

            console.log("Applied multiple makeColumnsUnique calls with different unique values");

            // Verify only the last operation is applied (replace all with composite unique)
            const indexes = await db.schema.getIndexes("products");
            const uniqueIndexes = indexes.filter(idx => idx.unique);
            
            expect(uniqueIndexes).toHaveLength(1);
            expect(uniqueIndexes[0]!.columns).toEqual(["category", "brand"]);

            // Test that the final constraint works
            // This should work (different category/brand combination)
            await db.insert("products").values({
                name: "Laptop", // Duplicate name is now allowed
                sku: "LAP001", // Duplicate sku is now allowed
                category: "Electronics",
                brand: "HP" // Different brand
            }).execute();

            // This should fail (duplicate category/brand)
            try {
                await db.insert("products").values({
                    name: "Desktop",
                    sku: "DESK001",
                    category: "Electronics",
                    brand: "Dell" // Duplicate category/brand combination
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            console.log("✅ Multiple makeColumnsUnique calls with different unique values work correctly");
        });

        test("should support makeColumnsUnique calls mixed with other operations", async () => {
            // Create a table
            await db.schema.createTable("orders")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "order_number",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "customer_id",
                    type: "INTEGER"
                })
                .addColumn({
                    name: "status",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            // Insert test data
            await db.insert("orders").values([
                { order_number: "ORD001", customer_id: 1, status: "pending" },
                { order_number: "ORD002", customer_id: 2, status: "completed" }
            ]).execute();

            console.log("Created table with test data");

            // Use makeColumnsUnique mixed with other operations
            await db.schema.alterTable("orders")
                .makeColumnsUnique(["order_number"], true) // First: add order_number unique
                .addColumn({
                    name: "created_at",
                    type: "TEXT",
                    notNull: true,
                    defaultValue: "2024-01-01"
                })
                .makeColumnsUnique(["customer_id", "status"], true) // Second: replace with composite unique
                .addForeignKey({
                    column: "customer_id",
                    references: { table: "customers", column: "id" },
                    onDelete: "CASCADE"
                })
                .execute();

            console.log("Applied makeColumnsUnique mixed with other operations");

            // Verify the final state
            const indexes = await db.schema.getIndexes("orders");
            const uniqueIndexes = indexes.filter(idx => idx.unique);
            
            expect(uniqueIndexes).toHaveLength(1);
            expect(uniqueIndexes[0]!.columns).toEqual(["customer_id", "status"]);

            // Verify foreign key was created
            const foreignKeys = await db.schema.getForeignKeys("orders");
            expect(foreignKeys).toHaveLength(1);
            expect(foreignKeys[0]!.column).toBe("customer_id");

            // Verify new column was added
            const tableInfo = await db.schema.getTableInfo("orders");
            const createdAtColumn = tableInfo.find(col => col.name === "created_at");
            expect(createdAtColumn).toBeDefined();
            expect(createdAtColumn!.notNull).toBe(true);

            console.log("✅ makeColumnsUnique mixed with other operations works correctly");
        });

        test("should not create duplicate unique indexes when makeColumnsUnique is called on existing unique columns", async () => {
            // Create a table with a column that has UNIQUE constraint in the table definition
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true,
                    unique: true // This creates a unique constraint at the column level
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            console.log("Created table with email column having UNIQUE constraint");

            // Check initial indexes
            const initialIndexes = await db.schema.getIndexes("users");
            const initialUniqueIndexes = initialIndexes.filter(idx => idx.unique);
            console.log("Initial unique indexes:", initialUniqueIndexes.map(idx => idx.name));

            // Call makeColumnsUnique on the email column (which already has a unique constraint)
            await db.schema.alterTable("users")
                .makeColumnsUnique(["email"])
                .execute();

            console.log("Called makeColumnsUnique on email column");

            // Check final indexes - should not have duplicates
            const finalIndexes = await db.schema.getIndexes("users");
            const finalUniqueIndexes = finalIndexes.filter(idx => idx.unique);
            console.log("Final unique indexes:", finalUniqueIndexes.map(idx => idx.name));

            // Should not have created duplicate indexes
            expect(finalUniqueIndexes.length).toBeLessThanOrEqual(2); // At most 2: one for email, one for id (primary key)

            // Test that the unique constraint still works
            await db.insert("users").values({
                email: "john@example.com",
                username: "john"
            }).execute();

            // This should fail due to unique constraint
            try {
                await db.insert("users").values({
                    email: "john@example.com", // Duplicate email
                    username: "jane"
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
            }

            console.log("✅ No duplicate unique indexes created");
        });

        test("should create multiple unique indexes when makeColumnsUnique is called multiple times with different columns", async () => {
            // Create a table without any unique constraints
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .execute();

            console.log("Created table without unique constraints");

            // First call: makeColumnsUnique on id
            await db.schema.alterTable("users")
                .makeColumnsUnique(["id"])
                .execute();

            console.log("Added unique index on id");

            // Second call: makeColumnsUnique on email
            await db.schema.alterTable("users")
                .makeColumnsUnique(["email"])
                .execute();

            console.log("Added unique index on email");

            // Check final indexes - should have both unique indexes
            const finalIndexes = await db.schema.getIndexes("users");
            const finalUniqueIndexes = finalIndexes.filter(idx => idx.unique);
            
            console.log("Final unique indexes:");
            finalUniqueIndexes.forEach(idx => {
                console.log(`  ${idx.name}: ${idx.columns.join(', ')}`);
            });

            // Should have 2 unique indexes: one for id and one for email
            expect(finalUniqueIndexes.length).toBeGreaterThanOrEqual(2);

            // Check that both id and email have unique constraints
            const idIndex = finalUniqueIndexes.find(idx => idx.columns.includes("id"));
            const emailIndex = finalUniqueIndexes.find(idx => idx.columns.includes("email"));

            expect(idIndex).toBeDefined();
            expect(emailIndex).toBeDefined();

            // Test that both unique constraints work
            await db.insert("users").values({
                id: 1,
                email: "john@example.com",
                username: "john"
            }).execute();

            console.log("✅ Added user with unique id and email");

            // This should fail (duplicate id)
            try {
                await db.insert("users").values({
                    id: 1, // Duplicate id
                    email: "jane@example.com",
                    username: "jane"
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
                console.log("✅ Correctly failed (duplicate id)");
            }

            // This should fail (duplicate email)
            try {
                await db.insert("users").values({
                    id: 2,
                    email: "john@example.com", // Duplicate email
                    username: "jane"
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain("UNIQUE constraint failed");
                console.log("✅ Correctly failed (duplicate email)");
            }

            // This should work (different id and email)
            await db.insert("users").values({
                id: 2,
                email: "jane@example.com",
                username: "jane"
            }).execute();

            console.log("✅ Added user with different id and email");

            console.log("✅ Multiple unique indexes created successfully");
        });

        test("should rename column in table", async () => {
            await db.schema.alterTable("users")
                .renameColumn("username", "user_name")
                .execute();

            const columns = await db.schema.getTableInfo("users");
            expect(columns).toHaveLength(2);
            expect(columns.find((c: any) => c.name === "user_name")).toBeDefined();
            expect(columns.find((c: any) => c.name === "username")).toBeUndefined();
        });

        test("should generate SQL for table alteration", () => {
            const sql = db.schema.alterTable("users")
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true
                })
                .dropColumn("username")
                .renameColumn("id", "user_id")
                .toSQL();

            expect(sql).toHaveLength(3);
            expect(sql[0]).toContain("ALTER TABLE users ADD COLUMN email TEXT NOT NULL");
            expect(sql[1]).toContain("ALTER TABLE users DROP COLUMN username");
            expect(sql[2]).toContain("ALTER TABLE users RENAME COLUMN id TO user_id");
        });
    });

    test("Index Management", () => {
        beforeEach(async () => {
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true
                })
                .execute();
        });

        test("should create index", async () => {
            await db.schema.createIndex("idx_users_email")
                .on("users")
                .columns(["email"])
                .unique(true)
                .execute();

            const indexes = await db.schema.getIndexes("users");
            expect(indexes).toHaveLength(1);
            expect(indexes[0]!.name).toBe("idx_users_email");
            expect(indexes[0]!.columns).toEqual(["email"]);
            expect(indexes[0]!.unique).toBe(true);
        });

        test("should create index with if not exists", async () => {
            await db.schema.createIndex("idx_users_email")
                .on("users")
                .columns(["email"])
                .ifNotExists(true)
                .execute();

            // Try to create the same index again - should not throw
            await db.schema.createIndex("idx_users_email")
                .on("users")
                .columns(["email"])
                .ifNotExists(true)
                .execute();

            const indexes = await db.schema.getIndexes("users");
            expect(indexes).toHaveLength(1);
        });

        test("should create multi-column index", async () => {
            await db.schema.createIndex("idx_users_email_username")
                .on("users")
                .columns(["email", "username"])
                .execute();

            const indexes = await db.schema.getIndexes("users");
            expect(indexes).toHaveLength(1);
            expect(indexes[0]!.columns).toEqual(["email", "username"]);
        });

        test("should create partial index", async () => {
            await db.schema.createIndex("idx_users_active")
                .on("users")
                .columns(["email"])
                .where("is_active = 1")
                .execute();

            const indexes = await db.schema.getIndexes("users");
            expect(indexes).toHaveLength(1);
            expect(indexes[0]!.where).toBe("is_active = 1");
        });

        test("should drop index", async () => {
            await db.schema.createIndex("idx_users_email")
                .on("users")
                .columns(["email"])
                .execute();

            await db.schema.dropIndex("idx_users_email").execute();

            const indexes = await db.schema.getIndexes("users");
            expect(indexes).toHaveLength(0);
        });

        test("should drop index with if exists", async () => {
            await db.schema.dropIndex("idx_users_email").ifExists(true).execute();

            // Try to drop non-existent index - should not throw
            await db.schema.dropIndex("idx_nonexistent").ifExists(true).execute();

            const indexes = await db.schema.getIndexes("users");
            expect(indexes).toHaveLength(0);
        });

        test("should generate SQL for index creation", () => {
            const sql = db.schema.createIndex("idx_users_email")
                .on("users")
                .columns(["email"])
                .unique(true)
                .ifNotExists(true)
                .toSQL();

            expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email");
            expect(sql).toContain("ON users (email)");
        });

        test("should generate SQL for index dropping", () => {
            const sql = db.schema.dropIndex("idx_users_email").ifExists(true).toSQL();
            expect(sql).toContain("DROP INDEX IF EXISTS idx_users_email");
        });
    });

    test("Schema Introspection", () => {
        beforeEach(async () => {
            await db.schema.createTable("users")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "username",
                    type: "TEXT",
                    notNull: true,
                    unique: true
                })
                .addColumn({
                    name: "email",
                    type: "TEXT",
                    notNull: true,
                    unique: true
                })
                .addColumn({
                    name: "age",
                    type: "INTEGER"
                })
                .addColumn({
                    name: "created_at",
                    type: "DATETIME",
                    defaultValue: "CURRENT_TIMESTAMP"
                })
                .addIndex({
                    name: "idx_users_email",
                    columns: ["email"],
                    unique: true
                })
                .execute();

            await db.schema.createTable("posts")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true,
                    autoIncrement: true
                })
                .addColumn({
                    name: "user_id",
                    type: "INTEGER",
                    notNull: true
                })
                .addColumn({
                    name: "title",
                    type: "TEXT",
                    notNull: true
                })
                .addForeignKey({
                    column: "user_id",
                    references: {
                        table: "users",
                        column: "id"
                    },
                    onDelete: "CASCADE"
                })
                .execute();
        });

        test("should check if table exists", async () => {
            const hasUsersTable = await db.schema.hasTable("users");
            const hasPostsTable = await db.schema.hasTable("posts");
            const hasNonExistentTable = await db.schema.hasTable("nonexistent");

            expect(hasUsersTable).toBe(true);
            expect(hasPostsTable).toBe(true);
            expect(hasNonExistentTable).toBe(false);
        });

        test("should check if column exists", async () => {
            const hasIdColumn = await db.schema.hasColumn("users", "id");
            const hasUsernameColumn = await db.schema.hasColumn("users", "username");
            const hasNonExistentColumn = await db.schema.hasColumn("users", "nonexistent");

            expect(hasIdColumn).toBe(true);
            expect(hasUsernameColumn).toBe(true);
            expect(hasNonExistentColumn).toBe(false);
        });

        test("should get table info", async () => {
            const columns = await db.schema.getTableInfo("users");
            expect(columns).toHaveLength(5);

            const idColumn = columns.find(c => c.name === "id");
            expect(idColumn).toBeDefined();
            expect(idColumn?.type).toBe("INTEGER");
            expect(idColumn?.primaryKey).toBe(true);
            expect(idColumn?.autoIncrement).toBe(true);

            const usernameColumn = columns.find(c => c.name === "username");
            expect(usernameColumn).toBeDefined();
            expect(usernameColumn?.type).toBe("TEXT");
            expect(usernameColumn?.notNull).toBe(true);
            expect(usernameColumn?.unique).toBe(true);

            const ageColumn = columns.find(c => c.name === "age");
            expect(ageColumn).toBeDefined();
            expect(ageColumn?.type).toBe("INTEGER");
            expect(ageColumn?.notNull).toBe(false);
        });

        test("should get foreign keys", async () => {
            const foreignKeys = await db.schema.getForeignKeys("posts");
            expect(foreignKeys).toHaveLength(1);
            expect(foreignKeys[0]!.column).toBe("user_id");
            expect(foreignKeys[0]!.references.table).toBe("users");
            expect(foreignKeys[0]!.references.column).toBe("id");
        });

        test("should get indexes", async () => {
            const indexes = await db.schema.getIndexes("users");
            expect(indexes).toHaveLength(1);
            expect(indexes[0]!.name).toBe("idx_users_email");
            expect(indexes[0]!.columns).toEqual(["email"]);
            expect(indexes[0]!.unique).toBe(true);
        });
    });
});
