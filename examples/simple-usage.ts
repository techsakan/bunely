/**
 * Simple Usage Examples for Bunely
 * 
 * This file demonstrates basic usage patterns of the Bunely SQLite wrapper
 */

import { createMemoryDatabase, createFileDatabase } from "../src/index";

console.log("=== Bunely Simple Usage Examples ===\n");

// 1. Create a database
console.log("1. Creating database...");
const db = createMemoryDatabase();
db.enableForeignKeys();
console.log("✅ Database created\n");

// 2. Create tables
console.log("2. Creating tables...");
await db.schema.createTable("users")
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
    .addColumn({
        name: "content",
        type: "TEXT"
    })
    .addColumn({
        name: "published",
        type: "BOOLEAN",
        defaultValue: false
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

console.log("✅ Tables created\n");

// 3. Insert data
console.log("3. Inserting data...");

// Insert users
const alice = await db.insert("users")
    .values({
        name: "Alice Johnson",
        email: "alice@example.com",
        age: 28
    })
    .execute();

const bob = await db.insert("users")
    .values({
        name: "Bob Smith",
        email: "bob@example.com",
        age: 32
    })
    .execute();

console.log(`Created users: Alice (ID: ${alice.lastInsertRowid}), Bob (ID: ${bob.lastInsertRowid})`);

// Insert posts
await db.insert("posts")
    .values({
        user_id: alice.lastInsertRowid,
        title: "Getting Started with Bunely",
        content: "This is a great SQLite wrapper!",
        published: true
    })
    .execute();

await db.insert("posts")
    .values({
        user_id: bob.lastInsertRowid,
        title: "Advanced SQLite Patterns",
        content: "Here are some advanced patterns...",
        published: false
    })
    .execute();

console.log("✅ Data inserted\n");

// 4. Query data with explicit where conditions
console.log("4. Querying data with explicit where conditions...");

// Basic where conditions
const aliceUser = await db.select()
    .from("users")
    .where("name", "=", "Alice Johnson")
    .first();
console.log("Alice user:", aliceUser);

// Comparison operators
const adults = await db.select()
    .from("users")
    .where("age", ">", 25)
    .execute();
console.log("Adults (>25):", adults);

// LIKE operator
const aliceUsers = await db.select()
    .from("users")
    .where("name", "LIKE", "Alice%")
    .execute();
console.log("Users with Alice name:", aliceUsers);

// IN operator
const specificUsers = await db.select()
    .from("users")
    .where("age", "IN", [28, 32])
    .execute();
console.log("Users aged 28 or 32:", specificUsers);

// BETWEEN operator
const middleAged = await db.select()
    .from("users")
    .where("age", "BETWEEN", 25, 35)
    .execute();
console.log("Middle-aged users (25-35):", middleAged);

// Multiple conditions
const publishedPosts = await db.select()
    .from("posts")
    .where("published", "=", true)
    .where("user_id", ">", 0)
    .execute();
console.log("Published posts:", publishedPosts);

console.log("✅ Queries executed\n");

// 5. Update data
console.log("5. Updating data...");

// Update with explicit where
const updateResult = await db.update("users")
    .set({ age: 29 })
    .where("name", "=", "Alice Johnson")
    .execute();
console.log(`Updated ${updateResult.changes} user(s)`);

// Update with comparison
const publishResult = await db.update("posts")
    .set({ published: true })
    .where("user_id", ">", 0)
    .execute();
console.log(`Published ${publishResult.changes} post(s)`);

console.log("✅ Data updated\n");

// 6. Delete data
console.log("6. Deleting data...");

// Delete with explicit where
const deleteResult = await db.delete("posts")
    .where("published", "=", false)
    .execute();
console.log(`Deleted ${deleteResult.changes} post(s)`);

console.log("✅ Data deleted\n");

// 7. Complex queries with joins
console.log("7. Complex queries with joins...");

const postsWithUsers = await db.select([
    "p.title",
    "p.content",
    "p.published",
    "u.name as author"
])
    .from("posts as p")
    .join("users as u", "p.user_id = u.id")
    .where("p.published", "=", true)
    .execute();
console.log("Published posts with authors:", postsWithUsers);

console.log("✅ Complex queries executed\n");

// 8. Transactions
console.log("8. Using transactions...");

await db.transaction(async (tx) => {
    // Create a new user
    const newUser = await tx.insert("users")
        .values({
            name: "Charlie Brown",
            email: "charlie@example.com",
            age: 25
        })
        .execute();

    // Create a post for the user
    await tx.insert("posts")
        .values({
            user_id: newUser.lastInsertRowid,
            title: "Transaction Example",
            content: "This was created in a transaction!",
            published: true
        })
        .execute();

    console.log("✅ Transaction completed successfully");
});

console.log("✅ Transaction executed\n");

// 9. Convenience methods
console.log("9. Using convenience methods...");

// Find records
const allUsers = await db.find("users");
console.log("All users:", allUsers);

// Find one record
const bobUser = await db.findOne("users", { name: "Bob Smith" });
console.log("Bob user:", bobUser);

// Create record
const newPost = await db.create("posts", {
    user_id: bob.lastInsertRowid,
    title: "Convenience Method Example",
    content: "Created with db.create()",
    published: true
});
console.log("Created post:", newPost);

// Update one record
const updateOneResult = await db.updateOne("posts", 
    { published: false }, 
    { id: newPost.lastInsertRowid }
);
console.log(`Updated ${updateOneResult.changes} post(s)`);

// Delete one record
const deleteOneResult = await db.deleteOne("posts", { id: newPost.lastInsertRowid });
console.log(`Deleted ${deleteOneResult.changes} post(s)`);

console.log("✅ Convenience methods executed\n");

// 10. Raw SQL when needed
console.log("10. Using raw SQL...");

const userCount = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM users");
console.log("Total users:", userCount?.count);

const postsByUser = await db.all(`
    SELECT 
        u.name,
        COUNT(p.id) as post_count
    FROM users u
    LEFT JOIN posts p ON u.id = p.user_id
    GROUP BY u.id, u.name
    ORDER BY post_count DESC
`);
console.log("Posts by user:", postsByUser);

console.log("✅ Raw SQL executed\n");

// 11. Schema introspection
console.log("11. Schema introspection...");

const hasUsersTable = await db.schema.hasTable("users");
console.log("Has users table:", hasUsersTable);

const userColumns = await db.schema.getTableInfo("users");
console.log("Users table columns:", userColumns.map(col => `${col.name}: ${col.type}`));

const foreignKeys = await db.schema.getForeignKeys("posts");
console.log("Posts foreign keys:", foreignKeys);

console.log("✅ Schema introspection completed\n");

// 12. Cleanup
console.log("12. Cleanup...");
db.close();
console.log("✅ Database closed");

console.log("\n=== Simple Usage Examples Complete ===");
