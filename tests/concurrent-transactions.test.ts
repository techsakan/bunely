/**
 * Tests for concurrent transactions with execute() to identify database locking issues
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser, type TestPost } from "./setup";
import type { Database } from "../src";

test("Concurrent Transactions with Execute()", () => {
    let db: Database;

    beforeEach(async () => {
        db = await setupTestDatabase();
        await insertSampleData(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should handle multiple concurrent transactions with execute()", async () => {
        const transactionCount = 10;
        const promises: Promise<any>[] = [];
        const results: any[] = [];

        // Create multiple concurrent transactions
        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                // Use execute() method in transaction
                const userResult = await tx.insert("users")
                    .values({
                        username: `concurrent_user_${i}`,
                        email: `concurrent_${i}@example.com`,
                        age: 20 + i
                    })
                    .execute();

                const postResult = await tx.insert("posts")
                    .values({
                        user_id: userResult.lastInsertRowid,
                        title: `Concurrent Post ${i}`,
                        content: `Content for concurrent post ${i}`,
                        status: "published"
                    })
                    .execute();

                return { userId: userResult.lastInsertRowid, postId: postResult.lastInsertRowid };
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        try {
            const allResults = await Promise.all(promises);
            results.push(...allResults);
        } catch (error) {
            console.error("Concurrent transaction error:", error);
            throw error;
        }

        // Verify all transactions completed successfully
        expect(results).toHaveLength(transactionCount);

        // Verify all users were created
        const allUsers = await db.find<TestUser>("users", { username: { $like: "concurrent_user_%" } });
        expect(allUsers).toHaveLength(transactionCount);

        // Verify all posts were created
        const allPosts = await db.find<TestPost>("posts", { title: { $like: "Concurrent Post %" } });
        expect(allPosts).toHaveLength(transactionCount);
    });

    test("should handle concurrent transactions with mixed execute() operations", async () => {
        const transactionCount = 5;
        const promises: Promise<any>[] = [];

        // Create mixed concurrent transactions (insert, update, delete)
        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                if (i % 3 === 0) {
                    // Insert operation
                    return await tx.insert("users")
                        .values({
                            username: `mixed_user_${i}`,
                            email: `mixed_${i}@example.com`,
                            age: 25 + i
                        })
                        .execute();
                } else if (i % 3 === 1) {
                    // Update operation
                    return await tx.update("users")
                        .set({ age: 30 + i })
                        .where({ username: "alice" })
                        .execute();
                } else {
                    // Delete operation (on a user we'll create first)
                    const tempUser = await tx.insert("users")
                        .values({
                            username: `temp_user_${i}`,
                            email: `temp_${i}@example.com`,
                            age: 35 + i
                        })
                        .execute();

                    return await tx.delete("users")
                        .where({ id: tempUser.lastInsertRowid })
                        .execute();
                }
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        try {
            await Promise.all(promises);
        } catch (error) {
            console.error("Mixed concurrent transaction error:", error);
            throw error;
        }

        // Verify operations completed (some users should exist, some deleted)
        const remainingUsers = await db.find<TestUser>("users");
        expect(remainingUsers.length).toBeGreaterThan(0);
    });

    test("should handle concurrent transactions with nested execute() calls", async () => {
        const transactionCount = 3;
        const promises: Promise<any>[] = [];

        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (outerTx) => {
                // Outer transaction with execute()
                const userResult = await outerTx.insert("users")
                    .values({
                        username: `nested_user_${i}`,
                        email: `nested_${i}@example.com`,
                        age: 25 + i
                    })
                    .execute();

                // Nested transaction with execute()
                await outerTx.transaction(async (innerTx) => {
                    const postResult = await innerTx.insert("posts")
                        .values({
                            user_id: userResult.lastInsertRowid,
                            title: `Nested Post ${i}`,
                            content: `Nested content ${i}`,
                            status: "published"
                        })
                        .execute();

                    // Another execute() in nested transaction
                    await innerTx.update("posts")
                        .set({ status: "draft" })
                        .where({ id: postResult.lastInsertRowid })
                        .execute();

                    return postResult;
                });

                return userResult;
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        try {
            await Promise.all(promises);
        } catch (error) {
            console.error("Nested concurrent transaction error:", error);
            throw error;
        }

        // Verify nested transactions completed
        const nestedUsers = await db.find<TestUser>("users", { username: { $like: "nested_user_%" } });
        expect(nestedUsers).toHaveLength(transactionCount);

        const nestedPosts = await db.find<TestPost>("posts", { title: { $like: "Nested Post %" } });
        expect(nestedPosts).toHaveLength(transactionCount);
        expect(nestedPosts.every(post => post.status === "draft")).toBe(true);
    });

    test("should handle concurrent transactions with schema operations and execute()", async () => {
        const transactionCount = 2;
        const promises: Promise<any>[] = [];

        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                // Create table in transaction
                await tx.schema.createTable(`test_table_${i}`)
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

                // Insert data using execute()
                const insertResult = await tx.insert(`test_table_${i}`)
                    .values({ name: `Test Data ${i}` })
                    .execute();

                // Update using execute()
                await tx.update(`test_table_${i}`)
                    .set({ name: `Updated Data ${i}` })
                    .where({ id: insertResult.lastInsertRowid })
                    .execute();

                return insertResult;
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        try {
            await Promise.all(promises);
        } catch (error) {
            console.error("Schema concurrent transaction error:", error);
            throw error;
        }

        // Verify tables were created and data was inserted
        for (let i = 0; i < transactionCount; i++) {
            const hasTable = await db.schema.hasTable(`test_table_${i}`);
            expect(hasTable).toBe(true);

            const data = await db.select().from(`test_table_${i}`).execute();
            expect(data).toHaveLength(1);
            expect(data[0].name).toBe(`Updated Data ${i}`);
        }
    });

    test("should handle concurrent transactions with raw SQL and execute()", async () => {
        const transactionCount = 4;
        const promises: Promise<any>[] = [];

        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                // Mix raw SQL with execute()
                const rawResult = tx.run("INSERT INTO users (username, email, age) VALUES (?, ?, ?)", 
                    [`raw_user_${i}`, `raw_${i}@example.com`, 20 + i]);

                // Use execute() after raw SQL
                const postResult = await tx.insert("posts")
                    .values({
                        user_id: rawResult.lastInsertRowid,
                        title: `Raw SQL Post ${i}`,
                        content: `Created with raw SQL ${i}`,
                        status: "published"
                    })
                    .execute();

                // More raw SQL
                const updateResult = tx.run("UPDATE posts SET status = ? WHERE id = ?", 
                    ["draft", postResult.lastInsertRowid]);

                return { userId: rawResult.lastInsertRowid, postId: postResult.lastInsertRowid };
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        try {
            await Promise.all(promises);
        } catch (error) {
            console.error("Raw SQL concurrent transaction error:", error);
            throw error;
        }

        // Verify raw SQL + execute() operations completed
        const rawUsers = await db.find<TestUser>("users", { username: { $like: "raw_user_%" } });
        expect(rawUsers).toHaveLength(transactionCount);

        const rawPosts = await db.find<TestPost>("posts", { title: { $like: "Raw SQL Post %" } });
        expect(rawPosts).toHaveLength(transactionCount);
        expect(rawPosts.every(post => post.status === "draft")).toBe(true);
    });

    test("should handle high-frequency concurrent transactions", async () => {
        const transactionCount = 20; // Higher frequency
        const promises: Promise<any>[] = [];
        const startTime = Date.now();

        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                // Quick execute() operations
                const result = await tx.insert("users")
                    .values({
                        username: `high_freq_${i}`,
                        email: `freq_${i}@example.com`,
                        age: 18 + (i % 10)
                    })
                    .execute();

                return result;
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        let results: any[] = [];
        try {
            results = await Promise.all(promises);
        } catch (error) {
            console.error("High-frequency concurrent transaction error:", error);
            throw error;
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`High-frequency test: ${transactionCount} transactions completed in ${duration}ms`);

        // Verify all transactions completed
        expect(results).toHaveLength(transactionCount);

        // Verify all users were created
        const highFreqUsers = await db.find<TestUser>("users", { username: { $like: "high_freq_%" } });
        expect(highFreqUsers).toHaveLength(transactionCount);
    });

    test("should handle concurrent transactions with retry logic", async () => {
        const transactionCount = 5;
        const promises: Promise<any>[] = [];

        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                const result = await tx.insert("users")
                    .values({
                        username: `retry_user_${i}`,
                        email: `retry_${i}@example.com`,
                        age: 25 + i
                    })
                    .execute();

                return result;
            }, {
                tries: 3,
                backoffMs: 50
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        try {
            await Promise.all(promises);
        } catch (error) {
            console.error("Retry concurrent transaction error:", error);
            throw error;
        }

        // Verify retry transactions completed
        const retryUsers = await db.find<TestUser>("users", { username: { $like: "retry_user_%" } });
        expect(retryUsers).toHaveLength(transactionCount);
    });

    test("should handle concurrent transactions with different busy timeout settings", async () => {
        // Create a new database instance with different busy timeout
        const dbWithTimeout = await setupTestDatabase();
        dbWithTimeout.close(); // Close the test database
        const dbTimeout = await setupTestDatabase({ busyTimeoutMs: 1000 });

        const transactionCount = 3;
        const promises: Promise<any>[] = [];

        for (let i = 0; i < transactionCount; i++) {
            const promise = dbTimeout.transaction(async (tx) => {
                const result = await tx.insert("users")
                    .values({
                        username: `timeout_user_${i}`,
                        email: `timeout_${i}@example.com`,
                        age: 30 + i
                    })
                    .execute();

                return result;
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        try {
            await Promise.all(promises);
        } catch (error) {
            console.error("Timeout concurrent transaction error:", error);
            throw error;
        }

        // Verify timeout transactions completed
        const timeoutUsers = await dbTimeout.find<TestUser>("users", { username: { $like: "timeout_user_%" } });
        expect(timeoutUsers).toHaveLength(transactionCount);

        // Cleanup
        cleanupTestDatabase(dbTimeout);
    });
});
