/**
 * Examples of using the enhanced ALTER TABLE functionality
 */

import { Database } from "bun:sqlite";
import { createMemoryDatabase } from "../src";

// Create a database instance
const query = createMemoryDatabase();

// Enable foreign key constraints
query.enableForeignKeys();

async function demonstrateAlterTable() {
    console.log("=== ALTER TABLE Examples ===\n");

    // Create initial tables
    console.log("1. Creating initial tables...");
    await query.schema.createTable("users")
        .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
        .addColumn({ name: "name", type: "TEXT", notNull: true })
        .addColumn({ name: "email", type: "TEXT" })
        .execute();

    await query.schema.createTable("posts")
        .addColumn({ name: "id", type: "INTEGER", primaryKey: true })
        .addColumn({ name: "title", type: "TEXT", notNull: true })
        .addColumn({ name: "content", type: "TEXT" })
        .addColumn({ name: "user_id", type: "INTEGER" })
        .execute();

    console.log("✓ Tables created\n");

    // Insert some test data
    await query.insert("users").values([
        { name: "John Doe", email: "john@example.com" },
        { name: "Jane Smith", email: "jane@example.com" }
    ]).execute();

    await query.insert("posts").values([
        { title: "First Post", content: "This is my first post", user_id: 1 },
        { title: "Second Post", content: "This is my second post", user_id: 2 }
    ]).execute();

    console.log("✓ Test data inserted\n");

    // Example 1: Add a unique index
    console.log("2. Adding a unique index on email...");
    await query.schema.alterTable("users")
        .addIndex({
            name: "idx_users_email",
            columns: ["email"],
            unique: true
        })
        .execute();
    console.log("✓ Unique index added\n");

    // Example 2: Add a regular index
    console.log("3. Adding a regular index on user_id...");
    await query.schema.alterTable("posts")
        .addIndex({
            name: "idx_posts_user_id",
            columns: ["user_id"]
        })
        .execute();
    console.log("✓ Regular index added\n");

    // Example 3: Add a foreign key constraint (requires table recreation)
    console.log("4. Adding a foreign key constraint...");
    await query.schema.alterTable("posts")
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
    console.log("✓ Foreign key constraint added (table recreated)\n");

    // Example 4: Add a new column
    console.log("5. Adding a new column...");
    await query.schema.alterTable("posts")
        .addColumn({
            name: "created_at",
            type: "DATETIME",
            defaultValue: "CURRENT_TIMESTAMP"
        })
        .execute();
    console.log("✓ New column added\n");

    // Example 5: Drop an index
    console.log("6. Dropping an index...");
    await query.schema.alterTable("posts")
        .dropIndex("idx_posts_user_id")
        .execute();
    console.log("✓ Index dropped\n");

    // Example 6: Alter a column (on posts table to avoid foreign key reference issues)
    console.log("7. Altering a column...");
    await query.schema.alterTable("posts")
        .alterColumn("title", (col) => ({
            ...col,
            defaultValue: "Untitled Post"
        }))
        .execute();
    console.log("✓ Title column altered (added default value)\n");

    // Verify the results
    console.log("8. Verifying results...");
    
    // Check indexes
    const indexes = await query.schema.getIndexes("users");
    console.log("Indexes on users table:", indexes);
    
    const postIndexes = await query.schema.getIndexes("posts");
    console.log("Indexes on posts table:", postIndexes);
    
    // Check foreign keys
    const foreignKeys = await query.schema.getForeignKeys("posts");
    console.log("Foreign keys on posts table:", foreignKeys);
    
    // Check table structure
    const postsTableInfo = await query.schema.getTableInfo("posts");
    console.log("Posts table structure:", postsTableInfo);
    
    // Test foreign key constraint
    console.log("\n9. Testing foreign key constraint...");
    try {
        await query.insert("posts").values({
            title: "Invalid Post",
            user_id: 999  // This should fail
        }).execute();
        console.log("❌ Foreign key constraint not working");
    } catch (error) {
        console.log("✓ Foreign key constraint working - invalid insert rejected");
    }

    // Test valid insert
    try {
        await query.insert("posts").values({
            title: "Valid Post",
            user_id: 1  // This should work
        }).execute();
        console.log("✓ Valid insert succeeded");
    } catch (error: any) {
        console.log("❌ Valid insert failed:", error.message);
    }

    console.log("\n=== All examples completed successfully! ===");
}

// Run the examples
demonstrateAlterTable().catch(console.error);
