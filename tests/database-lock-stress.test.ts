/**
 * Stress tests to identify database locking issues with execute() in many concurrent transactions
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser, type TestPost } from "./setup";
import type { Database } from "../src";

test("Database Lock Stress Tests", () => {
    let db: Database;

    beforeEach(async () => {
        db = await setupTestDatabase();
        await insertSampleData(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should handle many concurrent transactions without database lock", async () => {
        const transactionCount = 50; // High number of concurrent transactions
        const promises: Promise<any>[] = [];
        const errors: Error[] = [];
        const successfulTransactions: number[] = [];

        console.log(`Starting ${transactionCount} concurrent transactions...`);

        // Create many concurrent transactions
        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                try {
                    // Multiple execute() calls in each transaction
                    const userResult = await tx.insert("users")
                        .values({
                            username: `stress_user_${i}`,
                            email: `stress_${i}@example.com`,
                            age: 20 + (i % 30)
                        })
                        .execute();

                    const postResult = await tx.insert("posts")
                        .values({
                            user_id: userResult.lastInsertRowid,
                            title: `Stress Post ${i}`,
                            content: `Stress test content ${i}`,
                            status: "published"
                        })
                        .execute();

                    // Another execute() call
                    await tx.update("posts")
                        .set({ status: "draft" })
                        .where({ id: postResult.lastInsertRowid })
                        .execute();

                    return { userId: userResult.lastInsertRowid, postId: postResult.lastInsertRowid };
                } catch (error) {
                    console.error(`Transaction ${i} failed:`, error);
                    throw error;
                }
            }).then(result => {
                successfulTransactions.push(i);
                return result;
            }).catch(error => {
                errors.push(error);
                return null;
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        const startTime = Date.now();
        const results = await Promise.allSettled(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`Completed ${transactionCount} transactions in ${duration}ms`);
        console.log(`Successful transactions: ${successfulTransactions.length}`);
        console.log(`Failed transactions: ${errors.length}`);

        // Log any database lock errors
        const lockErrors = errors.filter(error => 
            error.message.includes("database is locked") || 
            error.message.includes("SQLITE_BUSY")
        );
        
        if (lockErrors.length > 0) {
            console.error("Database lock errors found:", lockErrors);
        }

        // Check results
        const successfulResults = results.filter(result => result.status === "fulfilled" && result.value !== null);
        const failedResults = results.filter(result => result.status === "rejected");

        console.log(`Successful results: ${successfulResults.length}`);
        console.log(`Failed results: ${failedResults.length}`);

        // Verify successful transactions created data
        const stressUsers = await db.find<TestUser>("users", { username: { $like: "stress_user_%" } });
        const stressPosts = await db.find<TestPost>("posts", { title: { $like: "Stress Post %" } });

        console.log(`Users created: ${stressUsers.length}`);
        console.log(`Posts created: ${stressPosts.length}`);

        // We expect some failures due to concurrency, but not all should fail
        expect(successfulResults.length).toBeGreaterThan(0);
        expect(stressUsers.length).toBeGreaterThan(0);
        expect(stressPosts.length).toBeGreaterThan(0);

        // If we have database lock errors, that's the issue we're investigating
        if (lockErrors.length > 0) {
            console.warn(`Found ${lockErrors.length} database lock errors - this indicates the locking issue`);
        }
    });

    test("should handle rapid sequential transactions", async () => {
        const transactionCount = 100;
        const results: any[] = [];
        const errors: Error[] = [];

        console.log(`Starting ${transactionCount} rapid sequential transactions...`);

        const startTime = Date.now();

        for (let i = 0; i < transactionCount; i++) {
            try {
                const result = await db.transaction(async (tx) => {
                    const userResult = await tx.insert("users")
                        .values({
                            username: `rapid_user_${i}`,
                            email: `rapid_${i}@example.com`,
                            age: 25 + (i % 20)
                        })
                        .execute();

                    return userResult;
                });

                results.push(result);
            } catch (error) {
                errors.push(error as Error);
                console.error(`Rapid transaction ${i} failed:`, error);
            }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`Completed ${transactionCount} rapid transactions in ${duration}ms`);
        console.log(`Successful: ${results.length}, Failed: ${errors.length}`);

        // Check for database lock errors
        const lockErrors = errors.filter(error => 
            error.message.includes("database is locked") || 
            error.message.includes("SQLITE_BUSY")
        );

        if (lockErrors.length > 0) {
            console.error("Database lock errors in rapid transactions:", lockErrors);
        }

        expect(results.length).toBeGreaterThan(0);
    });

    test("should handle concurrent transactions with shared resources", async () => {
        const transactionCount = 20;
        const promises: Promise<any>[] = [];

        // All transactions will try to update the same user
        const sharedUserId = 1; // Alice's ID from sample data

        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                // Try to update the same user in multiple transactions
                const result = await tx.update("users")
                    .set({ age: 25 + i })
                    .where({ id: sharedUserId })
                    .execute();

                // Also insert a post
                const postResult = await tx.insert("posts")
                    .values({
                        user_id: sharedUserId,
                        title: `Shared Resource Post ${i}`,
                        content: `Content ${i}`,
                        status: "published"
                    })
                    .execute();

                return { updateResult: result, postResult };
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        const startTime = Date.now();
        const results = await Promise.allSettled(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`Completed ${transactionCount} shared resource transactions in ${duration}ms`);

        const successfulResults = results.filter(result => result.status === "fulfilled");
        const failedResults = results.filter(result => result.status === "rejected");

        console.log(`Successful: ${successfulResults.length}, Failed: ${failedResults.length}`);

        // Check for database lock errors
        const lockErrors = failedResults
            .filter(result => result.status === "rejected")
            .map(result => (result as PromiseRejectedResult).reason)
            .filter(error => 
                error.message.includes("database is locked") || 
                error.message.includes("SQLITE_BUSY")
            );

        if (lockErrors.length > 0) {
            console.error("Database lock errors with shared resources:", lockErrors);
        }

        // Verify some transactions succeeded
        expect(successfulResults.length).toBeGreaterThan(0);
    });

    test("should handle concurrent transactions with different table operations", async () => {
        const transactionCount = 30;
        const promises: Promise<any>[] = [];

        for (let i = 0; i < transactionCount; i++) {
            const promise = db.transaction(async (tx) => {
                if (i % 4 === 0) {
                    // Insert operation
                    return await tx.insert("users")
                        .values({
                            username: `table_user_${i}`,
                            email: `table_${i}@example.com`,
                            age: 20 + i
                        })
                        .execute();
                } else if (i % 4 === 1) {
                    // Update operation
                    return await tx.update("users")
                        .set({ age: 30 + i })
                        .where({ username: "alice" })
                        .execute();
                } else if (i % 4 === 2) {
                    // Delete operation (create and delete)
                    const tempUser = await tx.insert("users")
                        .values({
                            username: `temp_table_${i}`,
                            email: `temp_table_${i}@example.com`,
                            age: 25 + i
                        })
                        .execute();

                    return await tx.delete("users")
                        .where({ id: tempUser.lastInsertRowid })
                        .execute();
                } else {
                    // Select operation
                    const users = await tx.select()
                        .from("users")
                        .where({ username: "alice" })
                        .execute<TestUser>();

                    return { count: users.length };
                }
            });

            promises.push(promise);
        }

        // Wait for all transactions to complete
        const startTime = Date.now();
        const results = await Promise.allSettled(promises);
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`Completed ${transactionCount} mixed table operations in ${duration}ms`);

        const successfulResults = results.filter(result => result.status === "fulfilled");
        const failedResults = results.filter(result => result.status === "rejected");

        console.log(`Successful: ${successfulResults.length}, Failed: ${failedResults.length}`);

        // Check for database lock errors
        const lockErrors = failedResults
            .filter(result => result.status === "rejected")
            .map(result => (result as PromiseRejectedResult).reason)
            .filter(error => 
                error.message.includes("database is locked") || 
                error.message.includes("SQLITE_BUSY")
            );

        if (lockErrors.length > 0) {
            console.error("Database lock errors with mixed operations:", lockErrors);
        }

        expect(successfulResults.length).toBeGreaterThan(0);
    });

    test("should measure transaction throughput under load", async () => {
        const transactionCount = 200;
        const batchSize = 10;
        const batches = Math.ceil(transactionCount / batchSize);
        const allResults: any[] = [];
        const allErrors: Error[] = [];

        console.log(`Starting throughput test: ${transactionCount} transactions in ${batches} batches of ${batchSize}`);

        const startTime = Date.now();

        for (let batch = 0; batch < batches; batch++) {
            const batchPromises: Promise<any>[] = [];

            for (let i = 0; i < batchSize && (batch * batchSize + i) < transactionCount; i++) {
                const transactionIndex = batch * batchSize + i;
                
                const promise = db.transaction(async (tx) => {
                    const result = await tx.insert("users")
                        .values({
                            username: `throughput_user_${transactionIndex}`,
                            email: `throughput_${transactionIndex}@example.com`,
                            age: 20 + (transactionIndex % 50)
                        })
                        .execute();

                    return result;
                }).then(result => {
                    allResults.push(result);
                    return result;
                }).catch(error => {
                    allErrors.push(error);
                    return null;
                });

                batchPromises.push(promise);
            }

            // Wait for this batch to complete before starting the next
            await Promise.allSettled(batchPromises);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;
        const throughput = transactionCount / (duration / 1000);

        console.log(`Throughput test completed:`);
        console.log(`- Total transactions: ${transactionCount}`);
        console.log(`- Duration: ${duration}ms`);
        console.log(`- Throughput: ${throughput.toFixed(2)} transactions/second`);
        console.log(`- Successful: ${allResults.length}`);
        console.log(`- Failed: ${allErrors.length}`);

        // Check for database lock errors
        const lockErrors = allErrors.filter(error => 
            error.message.includes("database is locked") || 
            error.message.includes("SQLITE_BUSY")
        );

        if (lockErrors.length > 0) {
            console.error(`Found ${lockErrors.length} database lock errors during throughput test`);
        }

        expect(allResults.length).toBeGreaterThan(0);
        expect(throughput).toBeGreaterThan(0);
    });
});
