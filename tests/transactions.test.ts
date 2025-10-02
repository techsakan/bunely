/**
 * Tests for transaction functionality
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser, type TestPost } from "./setup";
import type { Database } from "../src";

test("Transaction Management", () => {
    let db: Database

    beforeEach(async () => {
        db = await setupTestDatabase();
        await insertSampleData(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should execute simple transaction", async () => {
        let transactionExecuted = false;

        await db.transaction(async (tx) => {
            transactionExecuted = true;

            // Insert a new user
            const userResult = await tx.insert("users")
                .values({
                    username: "david",
                    email: "david@example.com",
                    age: 30
                })
                .execute();

            // Insert a post for the user
            await tx.insert("posts")
                .values({
                    user_id: userResult.lastInsertRowid,
                    title: "Transaction Test Post",
                    content: "This was created in a transaction!",
                    status: "published"
                })
                .execute();
        });

        expect(transactionExecuted).toBe(true);

        // Verify the data was committed
        const david = await db.findOne<TestUser>("users", { username: "david" });
        expect(david).toBeDefined();
        expect(david?.username).toBe("david");

        const davidPosts = await db.find<TestPost>("posts", { user_id: david?.id });
        expect(davidPosts).toHaveLength(1);
        expect(davidPosts[0]!.title).toBe("Transaction Test Post");
    });

    test("should rollback transaction on error", async () => {
        let transactionExecuted = false;

        try {
            await db.transaction(async (tx) => {
                transactionExecuted = true;

                // Insert a user
                await tx.insert("users")
                    .values({
                        username: "eve",
                        email: "eve@example.com"
                    })
                    .execute();

                // This should cause an error (duplicate username)
                await tx.insert("users")
                    .values({
                        username: "eve",
                        email: "different@example.com"
                    })
                    .execute();
            });
        } catch (error) {
            // Expected error
        }

        expect(transactionExecuted).toBe(true);

        // Verify the data was rolled back
        const eve = await db.findOne<TestUser>("users", { username: "eve" });
        expect(eve).toBeUndefined();
    });

    test("should handle nested transactions", async () => {
        await db.transaction(async (outerTx) => {
            // Insert user in outer transaction
            const userResult = await outerTx.insert("users")
                .values({
                    username: "frank",
                    email: "frank@example.com"
                })
                .execute();

            // Nested transaction
            await outerTx.transaction(async (innerTx) => {
                // Insert post in inner transaction
                await innerTx.insert("posts")
                    .values({
                        user_id: userResult.lastInsertRowid,
                        title: "Nested Transaction Post",
                        content: "Created in nested transaction",
                        status: "published"
                    })
                    .execute();
            });
        });

        // Verify both operations were committed
        const frank = await db.findOne<TestUser>("users", { username: "frank" });
        expect(frank).toBeDefined();

        const frankPosts = await db.find<TestPost>("posts", { user_id: frank?.id });
        expect(frankPosts).toHaveLength(1);
        expect(frankPosts[0]!.title).toBe("Nested Transaction Post");
    });

    test("should rollback nested transaction on error", async () => {
        try {
            await db.transaction(async (outerTx) => {
                // Insert user in outer transaction
                const userResult = await outerTx.insert("users")
                    .values({
                        username: "grace",
                        email: "grace@example.com"
                    })
                    .execute();

                // Nested transaction that fails
                await outerTx.transaction(async (innerTx) => {
                    // Insert post in inner transaction
                    await innerTx.insert("posts")
                        .values({
                            user_id: userResult.lastInsertRowid,
                            title: "Nested Transaction Post",
                            content: "Created in nested transaction",
                            status: "published"
                        })
                        .execute();

                    // This should cause an error
                    await innerTx.insert("users")
                        .values({
                            username: "grace", // Duplicate username
                            email: "different@example.com"
                        })
                        .execute();
                });
            });
        } catch (error) {
            // Expected error
        }

        // Verify the outer transaction was also rolled back
        const grace = await db.findOne<TestUser>("users", { username: "grace" });
        expect(grace).toBeUndefined();
    });

    test("should handle transaction with retry options", async () => {
        let attemptCount = 0;

        await db.transaction(async (tx) => {
            attemptCount++;

            // Insert a user
            await tx.insert("users")
                .values({
                    username: "henry",
                    email: "henry@example.com"
                })
                .execute();
        }, {
            tries: 3,
            backoffMs: 10
        });

        expect(attemptCount).toBe(1);

        // Verify the data was committed
        const henry = await db.findOne<TestUser>("users", { username: "henry" });
        expect(henry).toBeDefined();
    });

    test("should handle transaction with immediate option", async () => {
        await db.transaction(async (tx) => {
            // Insert a user
            await tx.insert("users")
                .values({
                    username: "iris",
                    email: "iris@example.com"
                })
                .execute();
        }, {
            immediate: true
        });

        // Verify the data was committed
        const iris = await db.findOne<TestUser>("users", { username: "iris" });
        expect(iris).toBeDefined();
    });

    test("should handle transaction with foreign key constraints", async () => {
        db.enableForeignKeys();

        await db.transaction(async (tx) => {
            // Insert user
            const userResult = await tx.insert("users")
                .values({
                    username: "jack",
                    email: "jack@example.com"
                })
                .execute();

            // Insert post with foreign key
            await tx.insert("posts")
                .values({
                    user_id: userResult.lastInsertRowid,
                    title: "Foreign Key Test Post",
                    content: "Testing foreign key constraints in transaction",
                    status: "published"
                })
                .execute();
        });

        // Verify the data was committed
        const jack = await db.findOne<TestUser>("users", { username: "jack" });
        expect(jack).toBeDefined();

        const jackPosts = await db.find<TestPost>("posts", { user_id: jack?.id });
        expect(jackPosts).toHaveLength(1);
    });

    test("should rollback transaction with foreign key constraint violation", async () => {
        db.enableForeignKeys();

        try {
            await db.transaction(async (tx) => {
                // Insert user
                await tx.insert("users")
                    .values({
                        username: "kate",
                        email: "kate@example.com"
                    })
                    .execute();

                // Try to insert post with invalid foreign key
                await tx.insert("posts")
                    .values({
                        user_id: 999, // Non-existent user ID
                        title: "Invalid Foreign Key Post",
                        content: "This should fail",
                        status: "published"
                    })
                    .execute();
            });
        } catch (error) {
            // Expected error
        }

        // Verify the user was rolled back
        const kate = await db.findOne<TestUser>("users", { username: "kate" });
        expect(kate).toBeUndefined();
    });

    test("should handle complex transaction with multiple operations", async () => {
        await db.transaction(async (tx) => {
            // Insert multiple users
            const user1Result = await tx.insert("users")
                .values({
                    username: "lisa",
                    email: "lisa@example.com",
                    age: 25
                })
                .execute();

            const user2Result = await tx.insert("users")
                .values({
                    username: "mike",
                    email: "mike@example.com",
                    age: 30
                })
                .execute();

            // Insert posts for both users
            await tx.insert("posts")
                .values({
                    user_id: user1Result.lastInsertRowid,
                    title: "Lisa's Post",
                    content: "Lisa's first post",
                    status: "published"
                })
                .execute();

            await tx.insert("posts")
                .values({
                    user_id: user2Result.lastInsertRowid,
                    title: "Mike's Post",
                    content: "Mike's first post",
                    status: "draft"
                })
                .execute();

            // Update user ages
            await tx.update("users")
                .set({ age: 26 })
                .where({ username: "lisa" })
                .execute();

            await tx.update("users")
                .set({ age: 31 })
                .where({ username: "mike" })
                .execute();
        });

        // Verify all operations were committed
        const lisa = await db.findOne<TestUser>("users", { username: "lisa" });
        const mike = await db.findOne<TestUser>("users", { username: "mike" });

        expect(lisa).toBeDefined();
        expect(lisa?.age).toBe(26);
        expect(mike).toBeDefined();
        expect(mike?.age).toBe(31);

        const lisaPosts = await db.find<TestPost>("posts", { user_id: lisa?.id });
        const mikePosts = await db.find<TestPost>("posts", { user_id: mike?.id });

        expect(lisaPosts).toHaveLength(1);
        expect(lisaPosts[0]!.title).toBe("Lisa's Post");
        expect(mikePosts).toHaveLength(1);
        expect(mikePosts[0]!.title).toBe("Mike's Post");
    });

    test("should handle transaction with query builder methods", async () => {
        await db.transaction(async (tx) => {
            // Use convenience methods in transaction
            const user = await tx.create("users", {
                username: "nancy",
                email: "nancy@example.com",
                age: 28
            });

            const post = await tx.create("posts", {
                user_id: user.lastInsertRowid,
                title: "Nancy's Post",
                content: "Created with convenience methods",
                status: "published"
            });

            // Use find methods in transaction
            const foundUser = await tx.findOne<TestUser>("users", { username: "nancy" });
            expect(foundUser).toBeDefined();
            expect(foundUser?.username).toBe("nancy");

            // Use update methods in transaction
            await tx.updateOne("users", { age: 29 }, { username: "nancy" });

            // Use delete methods in transaction
            await tx.deleteOne("posts", { id: post.lastInsertRowid });
        });

        // Verify the user was created and updated
        const nancy = await db.findOne<TestUser>("users", { username: "nancy" });
        expect(nancy).toBeDefined();
        expect(nancy?.age).toBe(29);

        // Verify the post was deleted
        const nancyPosts = await db.find<TestPost>("posts", { user_id: nancy?.id });
        expect(nancyPosts).toHaveLength(0);
    });

    test("should handle transaction with schema operations", async () => {
        await db.transaction(async (tx) => {
            // Create a new table in transaction
            await tx.schema.createTable("test_table")
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
                .execute();

            // Insert data into the new table
            await tx.insert("test_table")
                .values({ name: "Test Data" })
                .execute();
        });

        // Verify the table was created and data was inserted
        const hasTable = await db.schema.hasTable("test_table");
        expect(hasTable).toBe(true);

        const testData = await db.select().from("test_table").execute();
        expect(testData).toHaveLength(1);
        expect(testData[0].name).toBe("Test Data");
    });

    test("should handle transaction rollback with schema operations", async () => {
        try {
            await db.transaction(async (tx) => {
                // Create a new table in transaction
                await tx.schema.createTable("test_table2")
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
                    .execute();

                // Insert data into the new table
                await tx.insert("test_table2")
                    .values({ name: "Test Data" })
                    .execute();

                // This should cause an error
                await tx.insert("test_table2")
                    .values({ name: null }) // NOT NULL constraint violation
                    .execute();
            });
        } catch (error) {
            // Expected error
        }

        // Verify the table was not created (rolled back)
        const hasTable = await db.schema.hasTable("test_table2");
        expect(hasTable).toBe(false);
    });
});
