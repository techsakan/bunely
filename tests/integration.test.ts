/**
 * Integration tests for the full Bunely workflow
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, type TestUser, type TestPost, type TestComment } from "./setup";
import type { Database } from "../src";

test("Integration Tests", () => {
    let db: Database;

    beforeEach(async () => {
        db = await setupTestDatabase();
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should handle complete blog workflow", async () => {
        // 1. Create users
        const alice = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                age: 28,
                is_active: true
            })
            .execute();

        const bob = await db.insert("users")
            .values({
                username: "bob",
                email: "bob@example.com",
                age: 32,
                is_active: true
            })
            .execute();

        // 2. Create posts
        const post1 = await db.insert("posts")
            .values({
                user_id: alice.lastInsertRowid,
                title: "Getting Started with Bunely",
                content: "This is a comprehensive guide to using Bunely...",
                status: "published"
            })
            .execute();

        const post2 = await db.insert("posts")
            .values({
                user_id: bob.lastInsertRowid,
                title: "Advanced SQLite Patterns",
                content: "Here are some advanced patterns for SQLite...",
                status: "draft"
            })
            .execute();

        // 3. Create comments
        await db.insert("comments")
            .values({
                post_id: post1.lastInsertRowid,
                user_id: bob.lastInsertRowid,
                content: "Great post! Very helpful."
            })
            .execute();

        await db.insert("comments")
            .values({
                post_id: post1.lastInsertRowid,
                user_id: alice.lastInsertRowid,
                content: "Thanks for the feedback!"
            })
            .execute();

        // 4. Query published posts with author info
        const publishedPosts = await db.select([
            "p.id",
            "p.title",
            "p.content",
            "u.username as author",
            "u.email as author_email"
        ])
            .from("posts as p")
            .join("users as u", "p.user_id = u.id")
            .where({ "p.status": "published" })
            .execute();

        expect(publishedPosts).toHaveLength(1);
        expect(publishedPosts[0].title).toBe("Getting Started with Bunely");
        expect(publishedPosts[0].author).toBe("alice");

        // 5. Query posts with comment counts
        const postsWithComments = await db.select([
            "p.id",
            "p.title",
            "u.username as author",
            "COUNT(c.id) as comment_count"
        ])
            .from("posts as p")
            .join("users as u", "p.user_id = u.id")
            .leftJoin("comments as c", "p.id = c.post_id")
            .groupBy(["p.id", "p.title", "u.username"])
            .execute();

        expect(postsWithComments).toHaveLength(2);
        const alicePost = postsWithComments.find(p => p.author === "alice");
        expect(alicePost?.comment_count).toBe(2);

        // 6. Update post status
        await db.update("posts")
            .set({ status: "published" })
            .where({ id: post2.lastInsertRowid })
            .execute();

        // 7. Query all published posts
        const allPublishedPosts = await db.select()
            .from("posts")
            .where({ status: "published" })
            .execute<TestPost>();

        expect(allPublishedPosts).toHaveLength(2);

        // 8. Delete a comment
        await db.delete("comments")
            .where({
                post_id: post1.lastInsertRowid,
                user_id: alice.lastInsertRowid
            })
            .execute();

        // 9. Verify comment was deleted
        const remainingComments = await db.select()
            .from("comments")
            .where({ post_id: post1.lastInsertRowid })
            .execute<TestComment>();

        expect(remainingComments).toHaveLength(1);
        expect(remainingComments[0]!.user_id).toBe(bob.lastInsertRowid);
    });

    test("should handle user management workflow", async () => {
        // 1. Create multiple users
        const users = await db.insert("users")
            .values([
                {
                    username: "alice",
                    email: "alice@example.com",
                    age: 28,
                    is_active: true
                },
                {
                    username: "bob",
                    email: "bob@example.com",
                    age: 32,
                    is_active: true
                },
                {
                    username: "charlie",
                    email: "charlie@example.com",
                    age: 25,
                    is_active: false
                }
            ])
            .execute();

        // 2. Query active users
        const activeUsers = await db.find<TestUser>("users", { is_active: true });
        expect(activeUsers).toHaveLength(2);

        // 3. Query users by age range
        const adultUsers = await db.select()
            .from("users")
            .whereRaw("age >= ?", [25])
            .orderBy(["age DESC"])
            .execute<TestUser>();

        expect(adultUsers).toHaveLength(3);
        expect(adultUsers[0]!.username).toBe("bob"); // 32 years old
        expect(adultUsers[1]!.username).toBe("alice"); // 28 years old
        expect(adultUsers[2]!.username).toBe("charlie"); // 25 years old

        // 4. Update user status
        await db.update("users")
            .set({ is_active: false })
            .where({ age: 30 })
            .whereRaw("age > ?", [30])
            .execute();

        // 5. Verify update
        const updatedBob = await db.findOne<TestUser>("users", { username: "bob" });
        expect(updatedBob?.is_active).toBe(false);

        // 6. Query active users again
        const remainingActiveUsers = await db.find<TestUser>("users", { is_active: true });
        expect(remainingActiveUsers).toHaveLength(1);
        expect(remainingActiveUsers[0]!.username).toBe("alice");

        // 7. Delete inactive users
        const deleteResult = await db.delete("users")
            .where({ is_active: false })
            .execute();

        expect(deleteResult.changes).toBe(2);

        // 8. Verify deletion
        const remainingUsers = await db.find<TestUser>("users");
        expect(remainingUsers).toHaveLength(1);
        expect(remainingUsers[0]!.username).toBe("alice");
    });

    test("should handle complex query scenarios", async () => {
        // Setup data
        const alice = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                age: 28,
                is_active: true
            })
            .execute();

        const bob = await db.insert("users")
            .values({
                username: "bob",
                email: "bob@example.com",
                age: 32,
                is_active: true
            })
            .execute();

        // Create posts with different statuses
        const posts = await db.insert("posts")
            .values([
                {
                    user_id: alice.lastInsertRowid,
                    title: "Post 1",
                    content: "Content 1",
                    status: "published"
                },
                {
                    user_id: alice.lastInsertRowid,
                    title: "Post 2",
                    content: "Content 2",
                    status: "draft"
                },
                {
                    user_id: bob.lastInsertRowid,
                    title: "Post 3",
                    content: "Content 3",
                    status: "published"
                },
                {
                    user_id: bob.lastInsertRowid,
                    title: "Post 4",
                    content: "Content 4",
                    status: "archived"
                }
            ])
            .execute();

        // 1. Complex join with aggregation
        const userStats = await db.select([
            "u.username",
            "u.email",
            "COUNT(p.id) as total_posts",
            "COUNT(CASE WHEN p.status = 'published' THEN 1 END) as published_posts",
            "COUNT(CASE WHEN p.status = 'draft' THEN 1 END) as draft_posts",
            "COUNT(CASE WHEN p.status = 'archived' THEN 1 END) as archived_posts"
        ])
            .from("users as u")
            .leftJoin("posts as p", "u.id = p.user_id")
            .where({ "u.is_active": true })
            .groupBy(["u.id", "u.username", "u.email"])
            .orderBy(["total_posts DESC"])
            .execute();

        expect(userStats).toHaveLength(2);
        expect(userStats[0].username).toBe("alice");
        expect(userStats[0].total_posts).toBe(2);
        expect(userStats[0].published_posts).toBe(1);
        expect(userStats[0].draft_posts).toBe(1);
        expect(userStats[0].archived_posts).toBe(0);

        // 2. Subquery with EXISTS
        const usersWithPublishedPosts = await db.select()
            .from("users as u")
            .whereRaw("EXISTS (SELECT 1 FROM posts p WHERE p.user_id = u.id AND p.status = 'published')")
            .execute<TestUser>();

        expect(usersWithPublishedPosts).toHaveLength(2);

        // 3. Window function (if supported)
        const postsWithRowNumbers = await db.select([
            "p.id",
            "p.title",
            "p.status",
            "u.username",
            "ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY p.id) as post_number"
        ])
            .from("posts as p")
            .join("users as u", "p.user_id = u.id")
            .orderBy(["p.user_id", "p.id"])
            .execute();

        expect(postsWithRowNumbers).toHaveLength(4);
        expect(postsWithRowNumbers[0].post_number).toBe(1);
        expect(postsWithRowNumbers[1].post_number).toBe(2);

        // 4. Complex WHERE with multiple conditions
        const specificPosts = await db.select()
            .from("posts as p")
            .join("users as u", "p.user_id = u.id")
            .where({
                "p.status": "published",
                "u.is_active": true
            })
            .whereRaw("u.age > ?", [25])
            .execute<TestPost>();

        expect(specificPosts).toHaveLength(2);
    });

    test("should handle transaction rollback scenarios", async () => {
        // 1. Successful transaction
        await db.transaction(async (tx) => {
            const user = await tx.insert("users")
                .values({
                    username: "alice",
                    email: "alice@example.com"
                })
                .execute();

            await tx.insert("posts")
                .values({
                    user_id: user.lastInsertRowid,
                    title: "Test Post",
                    content: "Test Content",
                    status: "published"
                })
                .execute();
        });

        // Verify data was committed
        const alice = await db.findOne<TestUser>("users", { username: "alice" });
        expect(alice).toBeDefined();

        const alicePosts = await db.find<TestPost>("posts", { user_id: alice?.id });
        expect(alicePosts).toHaveLength(1);

        // 2. Failed transaction
        try {
            await db.transaction(async (tx) => {
                const user = await tx.insert("users")
                    .values({
                        username: "bob",
                        email: "bob@example.com"
                    })
                    .execute();

                await tx.insert("posts")
                    .values({
                        user_id: user.lastInsertRowid,
                        title: "Test Post 2",
                        content: "Test Content 2",
                        status: "published"
                    })
                    .execute();

                // This should cause a rollback
                await tx.insert("users")
                    .values({
                        username: "bob", // Duplicate username
                        email: "different@example.com"
                    })
                    .execute();
            });
        } catch (error) {
            // Expected error
        }

        // Verify bob was not created (rolled back)
        const bob = await db.findOne<TestUser>("users", { username: "bob" });
        expect(bob).toBeUndefined();
    });

    test("should handle schema evolution", async () => {
        // 1. Create initial table
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
                name: "price",
                type: "REAL",
                notNull: true
            })
            .execute();

        // 2. Insert some data
        await db.insert("products")
            .values([
                { name: "Product 1", price: 10.99 },
                { name: "Product 2", price: 20.99 }
            ])
            .execute();

        // 3. Add new column
        await db.schema.alterTable("products")
            .addColumn({
                name: "description",
                type: "TEXT"
            })
            .execute();

        // 4. Update products with descriptions
        await db.update("products")
            .set({ description: "A great product" })
            .where({ name: "Product 1" })
            .execute();

        // 5. Create index on new column
        await db.schema.createIndex("idx_products_description")
            .on("products")
            .columns(["description"])
            .execute();

        // 6. Query with new column
        const products = await db.select()
            .from("products")
            .where({ description: "A great product" })
            .execute();

        expect(products).toHaveLength(1);
        expect(products[0].name).toBe("Product 1");

        // 7. Rename column
        await db.schema.alterTable("products")
            .renameColumn("price", "cost")
            .execute();

        // 8. Query with renamed column
        const expensiveProducts = await db.select()
            .from("products")
            .whereRaw("cost > ?", [15])
            .execute();

        expect(expensiveProducts).toHaveLength(1);
        expect(expensiveProducts[0].name).toBe("Product 2");
    });

    test("should handle performance scenarios", async () => {
        // 1. Create large dataset
        const users = [];
        for (let i = 0; i < 100; i++) {
            users.push({
                username: `user${i}`,
                email: `user${i}@example.com`,
                age: 20 + (i % 50),
                is_active: i % 2 === 0
            });
        }

        await db.insert("users").values(users).execute();

        // 2. Create posts for users
        const allUsers = await db.select().from("users").execute<TestUser>();
        const posts = [];
        for (let i = 0; i < allUsers.length; i++) {
            const user = allUsers[i];
            if (!user) continue;
            for (let j = 0; j < 3; j++) {
                posts.push({
                    user_id: user.id,
                    title: `Post ${j} by ${user.username}`,
                    content: `Content for post ${j}`,
                    status: j === 0 ? "published" : "draft"
                });
            }
        }

        await db.insert("posts").values(posts).execute();

        // 3. Test complex query performance
        const startTime = Date.now();

        const userPostCounts = await db.select([
            "u.username",
            "COUNT(p.id) as post_count",
            "COUNT(CASE WHEN p.status = 'published' THEN 1 END) as published_count"
        ])
            .from("users as u")
            .leftJoin("posts as p", "u.id = p.user_id")
            .where({ "u.is_active": true })
            .groupBy(["u.id", "u.username"])
            .having({ post_count: 3 })
            .orderBy(["post_count DESC"])
            .execute();

        const endTime = Date.now();
        const queryTime = endTime - startTime;

        expect(userPostCounts).toHaveLength(50); // 50 active users with 3 posts each
        expect(queryTime).toBeLessThan(1000); // Should complete in less than 1 second

        // 4. Test pagination
        const paginatedUsers = await db.select()
            .from("users")
            .where({ is_active: true })
            .orderBy(["username"])
            .limit(10)
            .offset(20)
            .execute<TestUser>();

        expect(paginatedUsers).toHaveLength(10);
        expect(paginatedUsers[0]!.username).toBe("user20");
    });
});
