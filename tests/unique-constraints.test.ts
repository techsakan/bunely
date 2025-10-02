/**
 * Test file for unique constraint preservation in ALTER TABLE operations
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createMemoryDatabase } from "../src";

describe("Unique Constraints Preservation", () => {
    let db: ReturnType<typeof createMemoryDatabase>;

    beforeEach(() => {
        db = createMemoryDatabase();
        db.enableForeignKeys();
    });

    // Helper function that mimics Zodula createTable
    const createTableLikeZodula = async (
        tableName: string,
        columns: Record<string, { type: string; notNull: boolean }>,
        constraints?: {
            unique?: string[][];
            foreignKeys?: Array<{
                columns: string[];
                references: { table: string; columns: string[] };
                onDelete?: string;
                onUpdate?: string;
            }>;
            index?: string[][];
        }
    ) => {
        // Check if table exists
        const isExists = await db.schema.hasTable(tableName);
        if (isExists) {
            return { success: true, data: "Table already exists" };
        }

        try {
            // Create table with basic columns
            const createTableBuilder = db.schema.createTable(tableName);

            // Add columns
            for (const [columnName, columnDef] of Object.entries(columns)) {
                createTableBuilder.addColumn({
                    name: columnName,
                    type: columnDef.type as any,
                    notNull: columnDef.notNull
                });
            }

            await createTableBuilder.execute();

            // Add unique constraints
            if (constraints?.unique) {
                for (let i = 0; i < constraints.unique.length; i++) {
                    const uniqueColumns = constraints.unique[i];
                    await db.schema.createIndex(`${tableName}_unique_${i}`)
                        .on(tableName)
                        .columns(uniqueColumns || [])
                        .unique()
                        .execute();
                }
            }

            // Add foreign key constraints
            if (constraints?.foreignKeys) {
                for (const fk of constraints.foreignKeys) {
                    await db.schema.alterTable(tableName)
                        .addForeignKey({
                            column: fk.columns[0]!, // Assuming single column FK for simplicity
                            references: {
                                table: fk.references.table,
                                column: fk.references.columns[0]!
                            },
                            onDelete: fk.onDelete as any,
                            onUpdate: fk.onUpdate as any
                        })
                        .execute();
                }
            }

            // Add regular indexes
            if (constraints?.index) {
                for (let i = 0; i < constraints.index.length; i++) {
                    const indexColumns = constraints.index[i];
                    await db.schema.createIndex(`${tableName}_index_${i}`)
                        .on(tableName)
                        .columns(indexColumns || [])
                        .execute();
                }
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: `Failed to create table: ${error}` };
        }
    };

    it("should preserve unique constraints when adding foreign keys", async () => {
        // Create users table with unique constraints
        await db.schema.createTable("users")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "email", type: "TEXT", unique: true })
            .addColumn({ name: "username", type: "TEXT", unique: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .execute();

        // Create posts table
        await db.schema.createTable("posts")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "title", type: "TEXT", notNull: true })
            .addColumn({ name: "user_id", type: "INTEGER" })
            .execute();

        // Insert initial data
        await db.insert("users").values([
            { email: "john@example.com", username: "john", name: "John Doe" },
            { email: "jane@example.com", username: "jane", name: "Jane Smith" }
        ]).execute();

        // Add foreign key constraint (this should preserve unique constraints)
        await db.schema.alterTable("posts")
            .addForeignKey({
                column: "user_id",
                references: { table: "users", column: "id" },
                onDelete: "CASCADE"
            })
            .execute();

        // Verify unique constraints are preserved in table structure
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

        // Test foreign key constraint works
        await expect(
            db.insert("posts").values({
                title: "Invalid Post",
                user_id: 999 // Non-existent user
            }).execute()
        ).rejects.toThrow();

        // Test valid insert
        await db.insert("posts").values({
            title: "Valid Post",
            user_id: 1 // Valid user
        }).execute();
    });

    it("should preserve unique constraints when dropping foreign keys", async () => {
        // Create tables with foreign key
        await db.schema.createTable("users")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "email", type: "TEXT", unique: true })
            .addColumn({ name: "username", type: "TEXT", unique: true })
            .execute();

        await db.schema.createTable("posts")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "title", type: "TEXT", notNull: true })
            .addColumn({ name: "user_id", type: "INTEGER" })
            .execute();

        // Add foreign key
        await db.schema.alterTable("posts")
            .addForeignKey({
                column: "user_id",
                references: { table: "users", column: "id" }
            })
            .execute();

        // Insert data first
        await db.insert("users").values({
            email: "test@example.com",
            username: "testuser"
        }).execute();

        // Drop foreign key (should preserve unique constraints)
        await db.schema.alterTable("posts")
            .dropForeignKey("user_id")
            .execute();

        // Verify unique constraints are still preserved
        const tableInfo = await db.schema.getTableInfo("users");
        const emailColumn = tableInfo.find(col => col.name === "email");
        const usernameColumn = tableInfo.find(col => col.name === "username");

        expect(emailColumn?.unique).toBe(true);
        expect(usernameColumn?.unique).toBe(true);

        // Test unique constraints still work
        await expect(
            db.insert("users").values({
                email: "test@example.com", // Duplicate email
                username: "different"
            }).execute()
        ).rejects.toThrow();
    });

    it("should preserve unique constraints when altering columns", async () => {
        // Create table with unique constraint
        await db.schema.createTable("products")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "sku", type: "TEXT", unique: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .addColumn({ name: "price", type: "REAL", defaultValue: 0.0 })
            .execute();

        // Insert test data
        await db.insert("products").values({
            sku: "PROD-001",
            name: "Test Product",
            price: 10.0
        }).execute();

        // Alter column (should preserve unique constraint)
        await db.schema.alterTable("products")
            .alterColumn("price", (col) => ({
                ...col,
                notNull: true
            }))
            .execute();

        // Verify unique constraint is preserved
        const tableInfo = await db.schema.getTableInfo("products");
        const skuColumn = tableInfo.find(col => col.name === "sku");
        const priceColumn = tableInfo.find(col => col.name === "price");

        expect(skuColumn?.unique).toBe(true);
        expect(priceColumn?.notNull).toBe(true);

        // Test unique constraint still works
        await expect(
            db.insert("products").values({
                sku: "PROD-001", // Duplicate SKU
                name: "Another Product",
                price: 15.0
            }).execute()
        ).rejects.toThrow();
    });

    it("should preserve unique constraints in transaction", async () => {
        await db.transaction(async (tx) => {
            // Create users table with unique constraints
            await tx.schema.createTable("users")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "email", type: "TEXT", unique: true })
                .addColumn({ name: "username", type: "TEXT", unique: true })
                .execute();

            // Create posts table
            await tx.schema.createTable("posts")
                .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
                .addColumn({ name: "title", type: "TEXT", notNull: true })
                .addColumn({ name: "user_id", type: "INTEGER" })
                .execute();

            // Add foreign key constraint
            await tx.schema.alterTable("posts")
                .addForeignKey({
                    column: "user_id",
                    references: { table: "users", column: "id" }
                })
                .execute();

            // Insert data
            await tx.insert("users").values({
                email: "test@example.com",
                username: "testuser"
            }).execute();

            await tx.insert("posts").values({
                title: "Test Post",
                user_id: 1
            }).execute();
        });

        // Verify unique constraints are preserved
        const tableInfo = await db.schema.getTableInfo("users");
        const emailColumn = tableInfo.find(col => col.name === "email");
        const usernameColumn = tableInfo.find(col => col.name === "username");

        expect(emailColumn?.unique).toBe(true);
        expect(usernameColumn?.unique).toBe(true);

        // Test constraints work
        await expect(
            db.insert("users").values({
                email: "test@example.com", // Duplicate
                username: "different"
            }).execute()
        ).rejects.toThrow();
    });

    it("should handle multiple unique constraints", async () => {
        // Create table with multiple unique constraints
        await db.schema.createTable("accounts")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "email", type: "TEXT", unique: true })
            .addColumn({ name: "username", type: "TEXT", unique: true })
            .addColumn({ name: "phone", type: "TEXT", unique: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .execute();

        // Insert data
        await db.insert("accounts").values({
            email: "user1@example.com",
            username: "user1",
            phone: "+1234567890",
            name: "User One"
        }).execute();

        // Create related table
        await db.schema.createTable("profiles")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "account_id", type: "INTEGER" })
            .addColumn({ name: "bio", type: "TEXT" })
            .execute();

        // Add foreign key (should preserve all unique constraints)
        await db.schema.alterTable("profiles")
            .addForeignKey({
                column: "account_id",
                references: { table: "accounts", column: "id" }
            })
            .execute();

        // Verify all unique constraints are preserved
        const tableInfo = await db.schema.getTableInfo("accounts");
        const emailColumn = tableInfo.find(col => col.name === "email");
        const usernameColumn = tableInfo.find(col => col.name === "username");
        const phoneColumn = tableInfo.find(col => col.name === "phone");

        expect(emailColumn?.unique).toBe(true);
        expect(usernameColumn?.unique).toBe(true);
        expect(phoneColumn?.unique).toBe(true);

        // Test all unique constraints work
        await expect(
            db.insert("accounts").values({
                email: "user1@example.com", // Duplicate email
                username: "different",
                phone: "+0987654321",
                name: "Another User"
            }).execute()
        ).rejects.toThrow();

        await expect(
            db.insert("accounts").values({
                email: "different@example.com",
                username: "user1", // Duplicate username
                phone: "+1111111111",
                name: "Another User"
            }).execute()
        ).rejects.toThrow();

        await expect(
            db.insert("accounts").values({
                email: "another@example.com",
                username: "another",
                phone: "+1234567890", // Duplicate phone
                name: "Another User"
            }).execute()
        ).rejects.toThrow();
    });

    it("should preserve unique constraints with indexes", async () => {
        // Create table with unique constraint and regular index
        await db.schema.createTable("articles")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "slug", type: "TEXT", unique: true })
            .addColumn({ name: "title", type: "TEXT", notNull: true })
            .addColumn({ name: "content", type: "TEXT" })
            .execute();

        // Add regular index
        await db.schema.createIndex("idx_articles_title")
            .on("articles")
            .columns(["title"])
            .execute();

        // Create related table
        await db.schema.createTable("comments")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true, unique: true })
            .addColumn({ name: "article_id", type: "INTEGER" })
            .addColumn({ name: "content", type: "TEXT", notNull: true })
            .execute();

        // Insert initial data
        await db.insert("articles").values({
            slug: "test-article",
            title: "Test Article",
            content: "Test content"
        }).execute();

        // Insert initial comment data
        await db.insert("comments").values({
            id: 1,
            article_id: 1,
            content: "First comment"
        }).execute();

        // Add foreign key (should preserve unique constraint and index)
        await db.schema.alterTable("comments")
            .addForeignKey({
                column: "article_id",
                references: { table: "articles", column: "id" }
            })
            .execute();

        // Verify unique constraint is preserved on articles table
        const articlesTableInfo = await db.schema.getTableInfo("articles");
        const slugColumn = articlesTableInfo.find(col => col.name === "slug");
        expect(slugColumn?.unique).toBe(true);

        // Verify unique constraint is preserved on comments table
        const commentsTableInfo = await db.schema.getTableInfo("comments");
        const idColumn = commentsTableInfo.find(col => col.name === "id");
        expect(idColumn?.unique).toBe(true);

        // Check applied foreign keys
        const foreignKeys = await db.schema.getForeignKeys("comments");

        // Verify foreign key was applied
        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]?.column).toBe("article_id");
        expect(foreignKeys[0]?.references.table).toBe("articles");
        expect(foreignKeys[0]?.references.column).toBe("id");

        // Verify index is preserved
        const indexes = await db.schema.getIndexes("articles");
        const titleIndex = indexes.find(idx => idx.name === "idx_articles_title");
        expect(titleIndex).toBeDefined();

        // Test unique constraint works on articles table
        await expect(
            db.insert("articles").values({
                slug: "test-article", // Duplicate slug
                title: "Another Article",
                content: "Another content"
            }).execute()
        ).rejects.toThrow();

        // Test unique constraint works on comments table
        await expect(
            db.insert("comments").values({
                id: 1, // Duplicate id (should be unique)
                article_id: 1,
                content: "Another comment"
            }).execute()
        ).rejects.toThrow();
    });

    it("should handle complex schema changes while preserving unique constraints", async () => {
        // Create initial table
        await db.schema.createTable("users")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "email", type: "TEXT", unique: true })
            .addColumn({ name: "username", type: "TEXT", unique: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .execute();

        // Insert data
        await db.insert("users").values({
            email: "test@example.com",
            username: "testuser",
            name: "Test User"
        }).execute();

        // Perform multiple schema changes
        await db.schema.alterTable("users")
            .addColumn({ name: "age", type: "INTEGER" })
            .execute();

        // Add phone column without unique constraint first
        await db.schema.alterTable("users")
            .addColumn({ name: "phone", type: "TEXT" })
            .execute();

        // Add unique constraint to phone column
        await db.schema.createIndex("idx_users_phone_unique")
            .on("users")
            .columns(["phone"])
            .unique()
            .execute();

        // Add more data
        await db.insert("users").values({
            email: "test2@example.com",
            username: "testuser2",
            name: "Test User 2",
            age: 25,
            phone: "+1234567890"
        }).execute();

        // Create posts table
        await db.schema.createTable("posts")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "title", type: "TEXT", notNull: true })
            .addColumn({ name: "user_id", type: "INTEGER" })
            .execute();

        // Add foreign key
        await db.schema.alterTable("posts")
            .addForeignKey({
                column: "user_id",
                references: { table: "users", column: "id" }
            })
            .execute();

        // Verify all unique constraints are preserved
        const tableInfo = await db.schema.getTableInfo("users");
        const emailColumn = tableInfo.find(col => col.name === "email");
        const usernameColumn = tableInfo.find(col => col.name === "username");

        expect(emailColumn?.unique).toBe(true);
        expect(usernameColumn?.unique).toBe(true);

        // Check that phone has unique index
        const indexes = await db.schema.getIndexes("users");
        const phoneIndex = indexes.find(idx => idx.name === "idx_users_phone_unique");
        expect(phoneIndex).toBeDefined();
        expect(phoneIndex?.unique).toBe(true);

        // Test all unique constraints work
        await expect(
            db.insert("users").values({
                email: "test@example.com", // Duplicate email
                username: "different",
                name: "Another User",
                phone: "+0987654321"
            }).execute()
        ).rejects.toThrow();

        await expect(
            db.insert("users").values({
                email: "different@example.com",
                username: "testuser", // Duplicate username
                name: "Another User",
                phone: "+1111111111"
            }).execute()
        ).rejects.toThrow();

        await expect(
            db.insert("users").values({
                email: "another@example.com",
                username: "another",
                name: "Another User",
                phone: "+1234567890" // Duplicate phone
            }).execute()
        ).rejects.toThrow();
    });

    it("should handle self-referencing foreign keys in alter table", async () => {
        // Create a table with a self-referencing foreign key
        await db.schema.createTable("categories")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .addColumn({ name: "parent_id", type: "INTEGER" })
            .execute();

        // Insert some data
        await db.insert("categories").values([
            { id: 1, name: "Root Category" },
            { id: 2, name: "Child Category" }
        ]).execute();

        // Add self-referencing foreign key
        await db.schema.alterTable("categories")
            .addForeignKey({
                column: "parent_id",
                references: { table: "categories", column: "id" },
                onDelete: "CASCADE"
            })
            .execute();

        // Verify foreign key was applied
        const foreignKeys = await db.schema.getForeignKeys("categories");

        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]?.column).toBe("parent_id");
        expect(foreignKeys[0]?.references.table).toBe("categories");
        expect(foreignKeys[0]?.references.column).toBe("id");
        expect(foreignKeys[0]?.onDelete).toBe("CASCADE");

        // Test that the foreign key constraint works
        await expect(
            db.insert("categories").values({
                id: 3,
                name: "Invalid Child",
                parent_id: 999 // Non-existent parent
            }).execute()
        ).rejects.toThrow();

        // Test valid insert
        await db.insert("categories").values({
            id: 3,
            name: "Valid Child",
            parent_id: 1 // Valid parent
        }).execute();

        // Test cascade delete
        await db.delete("categories").where("id", "=", 1).execute();

        // Verify cascade worked - child should be deleted too
        const remainingCategories = await db.select().from("categories").execute();
        expect(remainingCategories).toHaveLength(1);
        expect(remainingCategories[0]?.name).toBe("Child Category");
    });

    it("should handle transaction schema management with getTableInfo for uniques then add foreign key", async () => {
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

            // Insert initial data
            await tx.insert("users").values([
                { email: "john@example.com", username: "john", name: "John Doe" },
                { email: "jane@example.com", username: "jane", name: "Jane Smith" }
            ]).execute();

            await tx.insert("posts").values([
                { title: "First Post", user_id: 1 },
                { title: "Second Post", user_id: 2 }
            ]).execute();

            // Get table info to verify unique constraints before adding foreign key
            const usersTableInfoBefore = await tx.schema.getTableInfo("users");
            const postsTableInfoBefore = await tx.schema.getTableInfo("posts");

            // Verify unique constraints are present
            const emailColumn = usersTableInfoBefore.find(col => col.name === "email");
            const usernameColumn = usersTableInfoBefore.find(col => col.name === "username");

            expect(emailColumn?.unique).toBe(true);
            expect(usernameColumn?.unique).toBe(true);

            // Add foreign key constraint
            await tx.schema.alterTable("posts")
                .addForeignKey({
                    column: "user_id",
                    references: { table: "users", column: "id" },
                    onDelete: "CASCADE"
                })
                .execute();

            // Get table info again to verify unique constraints are preserved
            const usersTableInfoAfter = await tx.schema.getTableInfo("users");
            const postsTableInfoAfter = await tx.schema.getTableInfo("posts");

            // Verify unique constraints are still preserved
            const emailColumnAfter = usersTableInfoAfter.find(col => col.name === "email");
            const usernameColumnAfter = usersTableInfoAfter.find(col => col.name === "username");

            expect(emailColumnAfter?.unique).toBe(true);
            expect(usernameColumnAfter?.unique).toBe(true);

            // Verify foreign key was added
            const foreignKeys = await tx.schema.getForeignKeys("posts");

            expect(foreignKeys).toHaveLength(1);
            expect(foreignKeys[0]?.column).toBe("user_id");
            expect(foreignKeys[0]?.references.table).toBe("users");
            expect(foreignKeys[0]?.references.column).toBe("id");
            expect(foreignKeys[0]?.onDelete).toBe("CASCADE");

            // Test that unique constraints still work in transaction
            await expect(
                tx.insert("users").values({
                    email: "john@example.com", // Duplicate email
                    username: "different",
                    name: "Another User"
                }).execute()
            ).rejects.toThrow();

            // Test that foreign key constraint works in transaction
            await expect(
                tx.insert("posts").values({
                    title: "Invalid Post",
                    user_id: 999 // Non-existent user
                }).execute()
            ).rejects.toThrow();

            // Test valid insert in transaction
            await tx.insert("posts").values({
                title: "Valid Post",
                user_id: 1 // Valid user
            }).execute();
        });

        // Verify everything is still working after transaction commit
        const usersTableInfo = await db.schema.getTableInfo("users");
        const postsTableInfo = await db.schema.getTableInfo("posts");
        const foreignKeys = await db.schema.getForeignKeys("posts");

        // Verify unique constraints are preserved
        const emailColumn = usersTableInfo.find(col => col.name === "email");
        const usernameColumn = usersTableInfo.find(col => col.name === "username");

        expect(emailColumn?.unique).toBe(true);
        expect(usernameColumn?.unique).toBe(true);

        // Verify foreign key is preserved
        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]?.column).toBe("user_id");
        expect(foreignKeys[0]?.references.table).toBe("users");
        expect(foreignKeys[0]?.references.column).toBe("id");

        // Test constraints work after transaction
        await expect(
            db.insert("users").values({
                email: "jane@example.com", // Duplicate email
                username: "different",
                name: "Another User"
            }).execute()
        ).rejects.toThrow();

        await expect(
            db.insert("posts").values({
                title: "Another Invalid Post",
                user_id: 999 // Non-existent user
            }).execute()
        ).rejects.toThrow();
    });

    it("should create table with complex constraints like Zodula createTable", async () => {
        // Define columns similar to your ColumnsDefinition
        const columns = {
            id: { type: "INTEGER", notNull: true },
            name: { type: "TEXT", notNull: true },
            email: { type: "TEXT", notNull: false },
            parent_id: { type: "INTEGER", notNull: false },
            created_at: { type: "DATETIME", notNull: true }
        };

        // Define constraints similar to your ConstraintDefinition
        const constraints = {
            unique: [
                ["email"], // Single column unique
                ["name", "created_at"] // Multi-column unique
            ],
            foreignKeys: [
                {
                    columns: ["parent_id"],
                    references: {
                        table: "categories",
                        columns: ["id"]
                    },
                    onDelete: "CASCADE",
                    onUpdate: "RESTRICT"
                }
            ],
            index: [
                ["name"], // Single column index
                ["email", "created_at"] // Multi-column index
            ]
        };

        // Create the main table using Bunely
        await db.schema.createTable("categories")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .addColumn({ name: "email", type: "TEXT" })
            .addColumn({ name: "parent_id", type: "INTEGER" })
            .addColumn({ name: "created_at", type: "DATETIME", notNull: true, defaultValue: "CURRENT_TIMESTAMP" })
            .execute();

        // Add unique constraints
        await db.schema.createIndex("idx_categories_email_unique")
            .on("categories")
            .columns(["email"])
            .unique()
            .execute();

        await db.schema.createIndex("idx_categories_name_created_unique")
            .on("categories")
            .columns(["name", "created_at"])
            .unique()
            .execute();

        // Add foreign key constraint
        await db.schema.alterTable("categories")
            .addForeignKey({
                column: "parent_id",
                references: { table: "categories", column: "id" },
                onDelete: "CASCADE",
                onUpdate: "RESTRICT"
            })
            .execute();

        // Add regular indexes
        await db.schema.createIndex("idx_categories_name")
            .on("categories")
            .columns(["name"])
            .execute();

        await db.schema.createIndex("idx_categories_email_created")
            .on("categories")
            .columns(["email", "created_at"])
            .execute();

        // Insert test data
        await db.insert("categories").values([
            {
                name: "Root Category",
                email: "root@example.com",
                created_at: "2024-01-01 10:00:00"
            },
            {
                name: "Child Category",
                email: "child@example.com",
                parent_id: 1,
                created_at: "2024-01-02 10:00:00"
            }
        ]).execute();

        // Verify table structure
        const tableInfo = await db.schema.getTableInfo("categories");

        // Verify unique constraints work
        await expect(
            db.insert("categories").values({
                name: "Another Root",
                email: "root@example.com", // Duplicate email
                created_at: "2024-01-03 10:00:00"
            }).execute()
        ).rejects.toThrow();

        await expect(
            db.insert("categories").values({
                name: "Root Category", // Duplicate name
                email: "different@example.com",
                created_at: "2024-01-01 10:00:00" // Duplicate created_at
            }).execute()
        ).rejects.toThrow();

        // Verify foreign key constraint works
        await expect(
            db.insert("categories").values({
                name: "Invalid Child",
                email: "invalid@example.com",
                parent_id: 999, // Non-existent parent
                created_at: "2024-01-04 10:00:00"
            }).execute()
        ).rejects.toThrow();

        // Verify valid insert works
        await db.insert("categories").values({
            name: "Valid Child",
            email: "valid@example.com",
            parent_id: 1, // Valid parent
            created_at: "2024-01-05 10:00:00"
        }).execute();

        // Verify foreign keys
        const foreignKeys = await db.schema.getForeignKeys("categories");
        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]?.column).toBe("parent_id");
        expect(foreignKeys[0]?.references.table).toBe("categories");
        expect(foreignKeys[0]?.references.column).toBe("id");
        expect(foreignKeys[0]?.onDelete).toBe("CASCADE");
        expect(foreignKeys[0]?.onUpdate).toBe("RESTRICT");

        // Verify indexes
        const indexes = await db.schema.getIndexes("categories");

        const uniqueIndexes = indexes.filter(idx => idx.unique);
        const regularIndexes = indexes.filter(idx => !idx.unique);

        expect(uniqueIndexes).toHaveLength(2); // email unique and name+created_at unique
        expect(regularIndexes).toHaveLength(2); // name index and email+created_at index

        // Test cascade delete
        await db.delete("categories").where("id", "=", 1).execute();

        // Verify cascade worked - child should be deleted too
        const remainingCategories = await db.select().from("categories").execute();
        expect(remainingCategories).toHaveLength(1);
        expect(remainingCategories[0]?.name).toBe("Child Category");
    });

    it("should create table using Zodula-like helper function", async () => {
        // Define columns and constraints like your Zodula function
        const columns = {
            id: { type: "INTEGER", notNull: true },
            name: { type: "TEXT", notNull: true },
            email: { type: "TEXT", notNull: false },
            parent_id: { type: "INTEGER", notNull: false },
            created_at: { type: "DATETIME", notNull: true }
        };

        const constraints = {
            unique: [
                ["email"], // Single column unique
                ["name", "created_at"] // Multi-column unique
            ],
            foreignKeys: [
                {
                    columns: ["parent_id"],
                    references: {
                        table: "products",
                        columns: ["id"]
                    },
                    onDelete: "CASCADE",
                    onUpdate: "RESTRICT"
                }
            ],
            index: [
                ["name"], // Single column index
                ["email", "created_at"] // Multi-column index
            ]
        };

        // First create the referenced table
        await db.schema.createTable("products")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .execute();

        // Use the Zodula-like helper function
        const result = await createTableLikeZodula("categories", columns, constraints);

        expect(result.success).toBe(true);

        // Verify table was created
        const tableExists = await db.schema.hasTable("categories");
        expect(tableExists).toBe(true);

        // Verify constraints were applied
        const foreignKeys = await db.schema.getForeignKeys("categories");
        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]?.column).toBe("parent_id");
        expect(foreignKeys[0]?.references.table).toBe("products");
        expect(foreignKeys[0]?.references.column).toBe("id");

        const indexes = await db.schema.getIndexes("categories");
        const uniqueIndexes = indexes.filter(idx => idx.unique);
        const regularIndexes = indexes.filter(idx => !idx.unique);

        expect(uniqueIndexes).toHaveLength(2); // email unique and name+created_at unique
        expect(regularIndexes).toHaveLength(2); // name index and email+created_at index

        // Test that it handles existing table
        const result2 = await createTableLikeZodula("categories", columns, constraints);
        expect(result2.success).toBe(true);
        expect(result2.data).toBe("Table already exists");
    });

    it("should handle unique constraint on id column, add foreign key, and verify with getTableInfo", async () => {
        // Create users table with unique constraint on id
        await db.schema.createTable("users")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true, unique: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .addColumn({ name: "email", type: "TEXT", unique: true })
            .execute();

        // Create posts table
        await db.schema.createTable("posts")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true, unique: true })
            .addColumn({ name: "title", type: "TEXT", notNull: true })
            .addColumn({ name: "user_id", type: "INTEGER" })
            .execute();

        // Insert some data
        await db.insert("users").values([
            { id: 1, name: "John Doe", email: "john@example.com" },
            { id: 2, name: "Jane Smith", email: "jane@example.com" }
        ]).execute();

        await db.insert("posts").values([
            { id: 1, title: "First Post", user_id: 1 },
            { id: 2, title: "Second Post", user_id: 2 }
        ]).execute();

        // Get table info before adding foreign key
        const usersTableInfoBefore = await db.schema.getTableInfo("users");
        const postsTableInfoBefore = await db.schema.getTableInfo("posts");

        // Verify unique constraints are present
        const userIdColumn = usersTableInfoBefore.find(col => col.name === "id");
        const userEmailColumn = usersTableInfoBefore.find(col => col.name === "email");
        const postIdColumn = postsTableInfoBefore.find(col => col.name === "id");

        expect(userIdColumn?.unique).toBe(true);
        expect(userEmailColumn?.unique).toBe(true);
        expect(postIdColumn?.unique).toBe(true);

        // Add foreign key constraint
        await db.schema.alterTable("posts")
            .addForeignKey({
                column: "user_id",
                references: { table: "users", column: "id" },
                onDelete: "CASCADE"
            })
            .execute();

        // Get table info after adding foreign key
        const usersTableInfoAfter = await db.schema.getTableInfo("users");
        const postsTableInfoAfter = await db.schema.getTableInfo("posts");
        console.log(usersTableInfoAfter);

        // Verify unique constraints are still preserved
        const userIdColumnAfter = usersTableInfoAfter.find(col => col.name === "id");
        const userEmailColumnAfter = usersTableInfoAfter.find(col => col.name === "email");
        const postIdColumnAfter = postsTableInfoAfter.find(col => col.name === "id");

        expect(userIdColumnAfter?.unique).toBe(true);
        expect(userEmailColumnAfter?.unique).toBe(true);
        expect(postIdColumnAfter?.unique).toBe(true);

        // Verify foreign key was added
        const foreignKeys = await db.schema.getForeignKeys("posts");

        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]?.column).toBe("user_id");
        expect(foreignKeys[0]?.references.table).toBe("users");
        expect(foreignKeys[0]?.references.column).toBe("id");
        expect(foreignKeys[0]?.onDelete).toBe("CASCADE");

        // Test that unique constraints still work
        await expect(
            db.insert("users").values({
                id: 1, // Duplicate id (should be unique)
                name: "Another User",
                email: "different@example.com"
            }).execute()
        ).rejects.toThrow();

        await expect(
            db.insert("posts").values({
                id: 1, // Duplicate id (should be unique)
                title: "Another Post",
                user_id: 1
            }).execute()
        ).rejects.toThrow();

        // Test that foreign key constraint works
        await expect(
            db.insert("posts").values({
                id: 3,
                title: "Invalid Post",
                user_id: 999 // Non-existent user
            }).execute()
        ).rejects.toThrow();

        // Test valid insert
        await db.insert("posts").values({
            id: 3,
            title: "Valid Post",
            user_id: 1 // Valid user
        }).execute();

        // Test cascade delete
        await db.delete("users").where("id", "=", 1).execute();

        // Verify cascade worked - posts with user_id=1 should be deleted
        const remainingPosts = await db.select().from("posts").execute();
        expect(remainingPosts).toHaveLength(1);
        expect(remainingPosts[0]?.title).toBe("Second Post");
    });

    it("should handle foreign key reference to non-existent table gracefully", async () => {
        // Create users table
        await db.schema.createTable("users")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .execute();

        // Create posts table
        await db.schema.createTable("posts")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "title", type: "TEXT", notNull: true })
            .addColumn({ name: "user_id", type: "INTEGER" })
            .execute();

        // Try to add foreign key to non-existent table - should fail gracefully
        await expect(
            db.schema.alterTable("posts")
                .addForeignKey({
                    column: "user_id",
                    references: { table: "non_existent_table", column: "id" },
                    onDelete: "CASCADE"
                })
                .execute()
        ).rejects.toThrow();

        // Add foreign key to existing table - should work
        await db.schema.alterTable("posts")
            .addForeignKey({
                column: "user_id",
                references: { table: "users", column: "id" },
                onDelete: "CASCADE"
            })
            .execute();

        // Verify foreign key was added
        const foreignKeys = await db.schema.getForeignKeys("posts");
        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]?.column).toBe("user_id");
        expect(foreignKeys[0]?.references.table).toBe("users");
        expect(foreignKeys[0]?.references.column).toBe("id");
    });

    it("should handle complex foreign key scenarios with multiple tables", async () => {
        // Create a scenario that might cause the temp table issue
        await db.schema.createTable("zodula__Role")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .execute();

        await db.schema.createTable("zodula__User")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true })
            .addColumn({ name: "role_id", type: "INTEGER" })
            .execute();

        // Insert some data
        await db.insert("zodula__Role").values([
            { id: 1, name: "Admin" },
            { id: 2, name: "User" }
        ]).execute();

        await db.insert("zodula__User").values([
            { id: 1, name: "John", role_id: 1 },
            { id: 2, name: "Jane", role_id: 2 }
        ]).execute();

        // Add foreign key constraint
        await db.schema.alterTable("zodula__User")
            .addForeignKey({
                column: "role_id",
                references: { table: "zodula__Role", column: "id" },
                onDelete: "CASCADE"
            })
            .execute();

        // Verify foreign key was added
        const foreignKeys = await db.schema.getForeignKeys("zodula__User");
        expect(foreignKeys).toHaveLength(1);
        expect(foreignKeys[0]?.column).toBe("role_id");
        expect(foreignKeys[0]?.references.table).toBe("zodula__Role");
        expect(foreignKeys[0]?.references.column).toBe("id");

        // Test that the foreign key works
        await expect(
            db.insert("zodula__User").values({
                id: 3,
                name: "Invalid User",
                role_id: 999 // Non-existent role
            }).execute()
        ).rejects.toThrow();

        // Test valid insert
        await db.insert("zodula__User").values({
            id: 3,
            name: "Valid User",
            role_id: 1 // Valid role
        }).execute();

        // Test cascade delete
        await db.delete("zodula__Role").where("id", "=", 1).execute();

        // Verify cascade worked
        const remainingUsers = await db.select().from("zodula__User").execute();
        expect(remainingUsers).toHaveLength(1);
        expect(remainingUsers[0]?.name).toBe("Jane");
    });

    it("should correctly detect unique constraints in getTableInfo after createTable", async () => {
        // Create a table with a unique constraint (similar to your use case)
        await db.schema.createTable("tester__Profile")
            .addColumn({ name: "id", type: "TEXT", notNull: true, unique: true })
            .addColumn({ name: "parent_doctype", type: "TEXT", notNull: true })
            .addColumn({ name: "child_doctype", type: "TEXT", notNull: true })
            .addColumn({ name: "child_field_name", type: "TEXT", notNull: true })
            .addColumn({ name: "alias", type: "TEXT", notNull: false })
            .addColumn({ name: "type", type: "TEXT", notNull: true })
            .addColumn({ name: "reference_label", type: "TEXT", notNull: false })
            .addColumn({ name: "below_field", type: "TEXT", notNull: false })
            .addColumn({ name: "owner", type: "TEXT", notNull: false })
            .addColumn({ name: "created_at", type: "TEXT", notNull: true })
            .addColumn({ name: "updated_at", type: "TEXT", notNull: true })
            .addColumn({ name: "created_by", type: "TEXT", notNull: false })
            .addColumn({ name: "updated_by", type: "TEXT", notNull: false })
            .addColumn({ name: "doc_status", type: "TEXT", notNull: true })
            .addColumn({ name: "idx", type: "TEXT", notNull: false })
            .execute();

        // Get table info and verify unique constraint is detected
        const tableInfo = await db.schema.getTableInfo("tester__Profile");

        // Find the id column
        const idColumn = tableInfo.find(col => col.name === "id");

        // Verify that the unique constraint is properly detected
        expect(idColumn?.unique).toBe(true);
        expect(idColumn?.notNull).toBe(true);
        expect(idColumn?.type).toBe("TEXT");

        // Verify other columns don't have unique constraint
        const otherColumns = tableInfo.filter(col => col.name !== "id");
        otherColumns.forEach(col => {
            expect(col.unique).toBe(false);
        });

        // Test that the unique constraint actually works
        await db.insert("tester__Profile").values({
            id: "test-1",
            parent_doctype: "Parent",
            child_doctype: "Child",
            child_field_name: "field1",
            type: "Link",
            created_at: "2024-01-01",
            updated_at: "2024-01-01",
            doc_status: "Draft"
        }).execute();

        // Try to insert duplicate id - should fail
        await expect(
            db.insert("tester__Profile").values({
                id: "test-1", // Duplicate id
                parent_doctype: "Parent2",
                child_doctype: "Child2",
                child_field_name: "field2",
                type: "Link",
                created_at: "2024-01-01",
                updated_at: "2024-01-01",
                doc_status: "Draft"
            }).execute()
        ).rejects.toThrow();
    });

    it.skip("should handle multiple alterTable addForeign keys in multiple tables asynchronously", async () => {
        // Create multiple tables with unique constraints
        await db.schema.createTable("async_table1")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true })
            .addColumn({ name: "name", type: "TEXT", notNull: true, unique: true })
            .addColumn({ name: "email", type: "TEXT", notNull: true })
            .execute();

        await db.schema.createTable("async_table2")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true })
            .addColumn({ name: "title", type: "TEXT", notNull: true, unique: true })
            .addColumn({ name: "description", type: "TEXT" })
            .execute();

        await db.schema.createTable("async_table3")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true })
            .addColumn({ name: "code", type: "TEXT", notNull: true, unique: true })
            .addColumn({ name: "value", type: "TEXT", notNull: true })
            .execute();

        // Create a reference table
        await db.schema.createTable("async_reference")
            .addColumn({ name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true })
            .addColumn({ name: "ref_name", type: "TEXT", notNull: true, unique: true })
            .execute();

        // Insert some test data
        await db.insert("async_reference").values([
            { ref_name: "ref1" },
            { ref_name: "ref2" },
            { ref_name: "ref3" }
        ]).execute();

        await db.insert("async_table1").values([
            { name: "user1", email: "user1@test.com" },
            { name: "user2", email: "user2@test.com" }
        ]).execute();

        await db.insert("async_table2").values([
            { title: "post1", description: "First post" },
            { title: "post2", description: "Second post" }
        ]).execute();

        await db.insert("async_table3").values([
            { code: "code1", value: "Value 1" },
            { code: "code2", value: "Value 2" }
        ]).execute();

        // Add foreign key columns to each table
        await db.schema.alterTable("async_table1")
            .addColumn({ name: "ref_id", type: "INTEGER" })
            .execute();

        await db.schema.alterTable("async_table2")
            .addColumn({ name: "ref_id", type: "INTEGER" })
            .execute();

        await db.schema.alterTable("async_table3")
            .addColumn({ name: "ref_id", type: "INTEGER" })
            .execute();

        // Now add foreign keys asynchronously to all tables
        const foreignKeyPromises = [
            // Add foreign key to table1
            db.schema.alterTable("async_table1")
                .addForeignKey({
                    column: "ref_id",
                    references: { table: "async_reference", column: "id" },
                    onDelete: "CASCADE"
                })
                .execute(),

            // Add foreign key to table2
            db.schema.alterTable("async_table2")
                .addForeignKey({
                    column: "ref_id",
                    references: { table: "async_reference", column: "id" },
                    onDelete: "SET NULL"
                })
                .execute(),

            // Add foreign key to table3
            db.schema.alterTable("async_table3")
                .addForeignKey({
                    column: "ref_id",
                    references: { table: "async_reference", column: "id" },
                    onDelete: "RESTRICT"
                })
                .execute()
        ];

        // Wait for all foreign key additions to complete
        await Promise.all(foreignKeyPromises);

        // Verify all foreign keys were added successfully
        const fk1 = await db.schema.getForeignKeys("async_table1");
        const fk2 = await db.schema.getForeignKeys("async_table2");
        const fk3 = await db.schema.getForeignKeys("async_table3");

        expect(fk1).toHaveLength(1);
        expect(fk1[0]?.column).toBe("ref_id");
        expect(fk1[0]?.references.table).toBe("async_reference");
        expect(fk1[0]?.references.column).toBe("id");
        expect(fk1[0]?.onDelete).toBe("CASCADE");

        expect(fk2).toHaveLength(1);
        expect(fk2[0]?.column).toBe("ref_id");
        expect(fk2[0]?.references.table).toBe("async_reference");
        expect(fk2[0]?.references.column).toBe("id");
        expect(fk2[0]?.onDelete).toBe("SET NULL");

        expect(fk3).toHaveLength(1);
        expect(fk3[0]?.column).toBe("ref_id");
        expect(fk3[0]?.references.table).toBe("async_reference");
        expect(fk3[0]?.references.column).toBe("id");
        expect(fk3[0]?.onDelete).toBe("RESTRICT");

        // Verify unique constraints are still preserved
        const table1Info = await db.schema.getTableInfo("async_table1");
        const table2Info = await db.schema.getTableInfo("async_table2");
        const table3Info = await db.schema.getTableInfo("async_table3");

        const nameColumn = table1Info.find(col => col.name === "name");
        const titleColumn = table2Info.find(col => col.name === "title");
        const codeColumn = table3Info.find(col => col.name === "code");


        expect(nameColumn?.unique).toBe(true);
        expect(titleColumn?.unique).toBe(true);
        expect(codeColumn?.unique).toBe(true);

        // Test that foreign keys work correctly
        // Update records to reference the foreign key
        await db.update("async_table1")
            .set({ ref_id: 1 })
            .where("name", "=", "user1")
            .execute();

        await db.update("async_table2")
            .set({ ref_id: 1 }) // Change to reference id=1 for SET NULL test
            .where("title", "=", "post1")
            .execute();

        await db.update("async_table3")
            .set({ ref_id: 3 })
            .where("code", "=", "code1")
            .execute();

        // Test cascade delete (table1 has CASCADE)
        await db.delete("async_reference").where("id", "=", 1).execute();

        // Verify cascade worked for table1
        const remainingTable1 = await db.select().from("async_table1").execute();
        expect(remainingTable1).toHaveLength(1); // Only user2 should remain

        // Verify SET NULL worked for table2 (ref_id should be null)
        const table2Records = await db.select().from("async_table2").execute();
        const post1Record = table2Records.find(r => r.title === "post1");
        expect(post1Record?.ref_id).toBeNull();

        // Verify RESTRICT worked for table3 (record should still exist)
        const table3Records = await db.select().from("async_table3").execute();
        expect(table3Records).toHaveLength(2); // Both records should still exist

        // Test that we can't delete the referenced record due to RESTRICT
        await expect(
            db.delete("async_reference").where("id", "=", 3).execute()
        ).rejects.toThrow();
    });
});
