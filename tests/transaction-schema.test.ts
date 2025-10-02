/**
 * Test file for transaction-based schema operations
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createMemoryDatabase } from "../src";

describe("Transaction Schema Operations", () => {
    let db: ReturnType<typeof createMemoryDatabase>;

    beforeEach(() => {
        db = createMemoryDatabase();
        db.enableForeignKeys();
    });

    it("should create tables and add foreign keys in transaction", async () => {
        await db.transaction(async (tx) => {
            // Create users table first
            await tx.schema.createTable("users")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "name", type: "TEXT", notNull: true })
                .addColumn({ name: "email", type: "TEXT" })
                .execute();

            // Create posts table without foreign key initially
            await tx.schema.createTable("posts")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "title", type: "TEXT", notNull: true })
                .addColumn({ name: "content", type: "TEXT" })
                .addColumn({ name: "user_id", type: "INTEGER" })
                .execute();

            // Add foreign key constraint after both tables exist
            await tx.schema.alterTable("posts")
                .addForeignKey({
                    column: "user_id",
                    references: {
                        table: "users",
                        column: "id"
                    },
                    onDelete: "CASCADE",
                    onUpdate: "CASCADE"
                })
                .execute();

            // Add some data
            await tx.insert("users").values([
                { name: "John Doe", email: "john@example.com" },
                { name: "Jane Smith", email: "jane@example.com" }
            ]).execute();

            await tx.insert("posts").values([
                { title: "First Post", content: "Hello world", user_id: 1 },
                { title: "Second Post", content: "Another post", user_id: 2 }
            ]).execute();
        });

        // Verify tables exist
        expect(await db.schema.hasTable("users")).toBe(true);
        expect(await db.schema.hasTable("posts")).toBe(true);

        // Verify foreign key constraint
        const foreignKeys = await db.schema.getForeignKeys("posts");
        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]).toMatchObject({
            column: "user_id",
            references: {
                table: "users",
                column: "id"
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        });

        // Verify data
        const users = await db.select().from("users").execute();
        expect(users).toHaveLength(2);

        const posts = await db.select().from("posts").execute();
        expect(posts).toHaveLength(2);

        // Test foreign key constraint works
        await expect(
            db.insert("posts").values({
                title: "Invalid Post",
                user_id: 999 // Non-existent user
            }).execute()
        ).rejects.toThrow();
    });

    it("should create tables with foreign keys directly in transaction", async () => {
        await db.transaction(async (tx) => {
            // Create users table
            await tx.schema.createTable("users")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "name", type: "TEXT", notNull: true })
                .addColumn({ name: "email", type: "TEXT" })
                .execute();

            // Create posts table with foreign key directly
            await tx.schema.createTable("posts")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "title", type: "TEXT", notNull: true })
                .addColumn({ name: "content", type: "TEXT" })
                .addColumn({ name: "user_id", type: "INTEGER" })
                .addForeignKey({
                    column: "user_id",
                    references: {
                        table: "users",
                        column: "id"
                    },
                    onDelete: "CASCADE",
                    onUpdate: "CASCADE"
                })
                .execute();

            // Add data
            await tx.insert("users").values({ name: "Test User", email: "test@example.com" }).execute();
            await tx.insert("posts").values({ title: "Test Post", user_id: 1 }).execute();
        });

        // Verify foreign key constraint
        const foreignKeys = await db.schema.getForeignKeys("posts");
        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0].column).toBe("user_id");
    });

    it("should rollback transaction on error", async () => {
        try {
            await db.transaction(async (tx) => {
                // Create users table
                await tx.schema.createTable("users")
                    .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                    .addColumn({ name: "name", type: "TEXT", notNull: true })
                    .execute();

                // Try to add foreign key to non-existent table
                await tx.schema.alterTable("users")
                    .addForeignKey({
                        column: "id",
                        references: {
                            table: "nonexistent_table", // This will cause an error
                            column: "id"
                        }
                    })
                    .execute();
            });
        } catch (error) {
            // Expected to fail
        }

        // Verify that users table was not created due to rollback
        expect(await db.schema.hasTable("users")).toBe(false);
    });

    it("should handle complex schema operations in transaction", async () => {
        await db.transaction(async (tx) => {
            // Create multiple tables
            await tx.schema.createTable("categories")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "name", type: "TEXT", notNull: true })
                .execute();

            await tx.schema.createTable("users")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "name", type: "TEXT", notNull: true })
                .addColumn({ name: "email", type: "TEXT" })
                .execute();

            await tx.schema.createTable("posts")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "title", type: "TEXT", notNull: true })
                .addColumn({ name: "content", type: "TEXT" })
                .addColumn({ name: "user_id", type: "INTEGER" })
                .addColumn({ name: "category_id", type: "INTEGER" })
                .execute();

            // Add foreign keys
            await tx.schema.alterTable("posts")
                .addForeignKey({
                    column: "user_id",
                    references: { table: "users", column: "id" },
                    onDelete: "CASCADE"
                })
                .execute();

            await tx.schema.alterTable("posts")
                .addForeignKey({
                    column: "category_id",
                    references: { table: "categories", column: "id" },
                    onDelete: "SET NULL"
                })
                .execute();

            // Add indexes
            await tx.schema.alterTable("users")
                .addIndex({
                    name: "idx_users_email",
                    columns: ["email"],
                    unique: true
                })
                .execute();

            await tx.schema.alterTable("posts")
                .addIndex({
                    name: "idx_posts_user_id",
                    columns: ["user_id"]
                })
                .execute();

            // Insert test data
            await tx.insert("categories").values([
                { name: "Technology" },
                { name: "Science" }
            ]).execute();

            await tx.insert("users").values([
                { name: "John Doe", email: "john@example.com" },
                { name: "Jane Smith", email: "jane@example.com" }
            ]).execute();

            await tx.insert("posts").values([
                { title: "Tech Post", content: "About technology", user_id: 1, category_id: 1 },
                { title: "Science Post", content: "About science", user_id: 2, category_id: 2 }
            ]).execute();
        });

        // Verify all tables exist
        expect(await db.schema.hasTable("categories")).toBe(true);
        expect(await db.schema.hasTable("users")).toBe(true);
        expect(await db.schema.hasTable("posts")).toBe(true);

        // Verify foreign keys
        const postForeignKeys = await db.schema.getForeignKeys("posts");
        expect(postForeignKeys).toHaveLength(2);

        // Verify indexes
        const userIndexes = await db.schema.getIndexes("users");
        expect(userIndexes).toHaveLength(1);
        expect(userIndexes[0].name).toBe("idx_users_email");

        const postIndexes = await db.schema.getIndexes("posts");
        expect(postIndexes).toHaveLength(1);
        expect(postIndexes[0].name).toBe("idx_posts_user_id");

        // Verify data
        const posts = await db.select().from("posts").execute();
        expect(posts).toHaveLength(2);

        // Test foreign key constraints
        await expect(
            db.insert("posts").values({
                title: "Invalid Post",
                user_id: 999,
                category_id: 1
            }).execute()
        ).rejects.toThrow();
    });

    it("should handle alterColumn operations in transaction", async () => {
        await db.transaction(async (tx) => {
            // Create table
            await tx.schema.createTable("products")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "name", type: "TEXT", notNull: true })
                .addColumn({ name: "price", type: "INTEGER" })
                .addColumn({ name: "description", type: "TEXT" })
                .execute();

            // Alter columns
            await tx.schema.alterTable("products")
                .alterColumn("price", (col) => ({
                    ...col,
                    type: "REAL" as const,
                    notNull: true,
                    defaultValue: 0.0
                }))
                .execute();

            await tx.schema.alterTable("products")
                .alterColumn("description", (col) => ({
                    ...col,
                    notNull: true,
                    defaultValue: "No description"
                }))
                .execute();

            // Add index
            await tx.schema.alterTable("products")
                .addIndex({
                    name: "idx_products_name",
                    columns: ["name"]
                })
                .execute();

            // Insert data
            await tx.insert("products").values([
                { name: "Product 1", price: 10.5 },
                { name: "Product 2", price: 5.0 } // Provide price value
            ]).execute();
        });

        // Verify table structure
        const tableInfo = await db.schema.getTableInfo("products");
        const priceColumn = tableInfo.find(col => col.name === "price");
        const descColumn = tableInfo.find(col => col.name === "description");

        expect(priceColumn?.type).toBe("REAL");
        expect(priceColumn?.notNull).toBe(true);
        expect(descColumn?.notNull).toBe(true);

        // Verify data
        const products = await db.select().from("products").execute();
        expect(products).toHaveLength(2);
        expect(products[1].price).toBe(5.0); // The value we provided
        expect(products[1].description).toBe("No description");

        // Verify index
        const indexes = await db.schema.getIndexes("products");
        expect(indexes).toHaveLength(1);
        expect(indexes[0].name).toBe("idx_products_name");
    });

    it("should handle addColumn with defaultValue null in transaction", async () => {
        await db.transaction(async (tx) => {
            // Create table with addColumn defaultValue: null
            await tx.schema.createTable("test_create")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "name", type: "TEXT", notNull: true })
                .addColumn({ name: "description", type: "TEXT", defaultValue: null })
                .execute();

            // Create another table for alterTable test
            await tx.schema.createTable("test_alter")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "title", type: "TEXT", notNull: true })
                .execute();

            // Add column with defaultValue: null using alterTable
            await tx.schema.alterTable("test_alter")
                .addColumn({ name: "notes", type: "TEXT", defaultValue: null })
                .execute();

            // Insert data to test the null defaults
            await tx.insert("test_create").values([
                { name: "Item 1" },
                { name: "Item 2" }
            ]).execute();

            await tx.insert("test_alter").values([
                { title: "Title 1" },
                { title: "Title 2" }
            ]).execute();
        });

        // Verify createTable with defaultValue: null
        const createTableInfo = await db.schema.getTableInfo("test_create");
        const createDescColumn = createTableInfo.find(col => col.name === "description");
        expect(createDescColumn).toBeDefined();
        expect(createDescColumn?.type).toBe("TEXT");
        expect(createDescColumn?.defaultValue).toBe(null);

        // Verify alterTable with defaultValue: null
        const alterTableInfo = await db.schema.getTableInfo("test_alter");
        const alterNotesColumn = alterTableInfo.find(col => col.name === "notes");
        expect(alterNotesColumn).toBeDefined();
        expect(alterNotesColumn?.type).toBe("TEXT");
        expect(alterNotesColumn?.defaultValue).toBe(null);

        // Verify data was inserted correctly
        const createData = await db.select().from("test_create").execute();
        expect(createData).toHaveLength(2);
        expect(createData[0]!.name).toBe("Item 1");
        expect(createData[0]!.description).toBe(null);

        const alterData = await db.select().from("test_alter").execute();
        expect(alterData).toHaveLength(2);
        expect(alterData[0]!.title).toBe("Title 1");
        expect(alterData[0]!.notes).toBe(null);
    });

    it("should preserve unique constraints when adding foreign keys", async () => {
        await db.transaction(async (tx) => {
            // Create users table with unique constraints
            await tx.schema.createTable("users")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "email", type: "TEXT", unique: true })
                .addColumn({ name: "username", type: "TEXT", unique: true })
                .addColumn({ name: "name", type: "TEXT", notNull: true })
                .execute();

            // Create posts table
            await tx.schema.createTable("posts")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "title", type: "TEXT", notNull: true })
                .addColumn({ name: "user_id", type: "INTEGER" })
                .execute();

            // Add foreign key constraint (this should preserve unique constraints)
            await tx.schema.alterTable("posts")
                .addForeignKey({
                    column: "user_id",
                    references: { table: "users", column: "id" },
                    onDelete: "CASCADE"
                })
                .execute();

            // Insert test data
            await tx.insert("users").values([
                { email: "john@example.com", username: "john", name: "John Doe" },
                { email: "jane@example.com", username: "jane", name: "Jane Smith" }
            ]).execute();

            await tx.insert("posts").values([
                { title: "First Post", user_id: 1 },
                { title: "Second Post", user_id: 2 }
            ]).execute();
        });

        // Verify unique constraints are preserved
        const tableInfo = await db.schema.getTableInfo("users");
        const emailColumn = tableInfo.find(col => col.name === "email");
        const usernameColumn = tableInfo.find(col => col.name === "username");

        expect(emailColumn?.unique).toBe(true);
        expect(usernameColumn?.unique).toBe(true);

        // Test that unique constraints still work
        await expect(
            db.insert("users").values({
                email: "john@example.com", // Duplicate email
                username: "different",
                name: "Another User"
            }).execute()
        ).rejects.toThrow();

        await expect(
            db.insert("users").values({
                email: "new@example.com",
                username: "jane", // Duplicate username
                name: "Another User"
            }).execute()
        ).rejects.toThrow();

        // Test foreign key constraint
        await expect(
            db.insert("posts").values({
                title: "Invalid Post",
                user_id: 999 // Non-existent user
            }).execute()
        ).rejects.toThrow();
    });

    it("should handle mixed query and schema operations in transaction", async () => {
        await db.transaction(async (tx) => {
            // Create table
            await tx.schema.createTable("accounts")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "name", type: "TEXT", notNull: true })
                .addColumn({ name: "balance", type: "REAL", notNull: true, defaultValue: 0.0 })
                .execute();

            // Insert data
            await tx.insert("accounts").values([
                { name: "Account 1", balance: 100.0 },
                { name: "Account 2", balance: 200.0 }
            ]).execute();

            // Query data
            const accounts = await tx.select().from("accounts").execute();
            expect(accounts).toHaveLength(2);

            // Update data
            await tx.update("accounts")
                .set({ balance: 150.0 })
                .where("name", "=", "Account 1")
                .execute();

            // Verify update
            const updatedAccount = await tx.select().from("accounts")
                .where("name", "=", "Account 1")
                .first();
            expect(updatedAccount?.balance).toBe(150.0);

            // Add index
            await tx.schema.alterTable("accounts")
                .addIndex({
                    name: "idx_accounts_name",
                    columns: ["name"],
                    unique: true
                })
                .execute();
        });

        // Verify final state
        const accounts = await db.select().from("accounts").execute();
        expect(accounts).toHaveLength(2);

        const indexes = await db.schema.getIndexes("accounts");
        expect(indexes).toHaveLength(1);
        expect(indexes[0].unique).toBe(true);
    });
});
