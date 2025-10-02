/**
 * Tests to verify that transaction objects have access to all database methods
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser, type TestPost } from "./setup";
import type { Database } from "../src";

test("Transaction Method Access", async () => {
    const db = await setupTestDatabase();
    await insertSampleData(db);

    test("should have access to raw SQL methods in transaction", async () => {
        await db.transaction(async (tx) => {
            // Test run method
            const runResult = tx.run("SELECT 1 as test");
            expect(runResult).toBeDefined();

            // Test get method
            const getResult = tx.get<{ test: number }>("SELECT 42 as test");
            expect(getResult?.test).toBe(42);

            // Test all method
            const allResult = tx.all<{ test: number }>("SELECT 1 as test UNION SELECT 2 as test");
            expect(allResult).toHaveLength(2);
            expect(allResult[0]!.test).toBe(1);
            expect(allResult[1]!.test).toBe(2);
        });
    });

    test("should have access to convenience methods in transaction", async () => {
        await db.transaction(async (tx) => {
            // Test find method
            const users = await tx.find<TestUser>("users");
            expect(users).toHaveLength(3);

            // Test findOne method
            const alice = await tx.findOne<TestUser>("users", { username: "alice" });
            expect(alice).toBeDefined();
            expect(alice?.username).toBe("alice");

            // Test create method
            const newUser = await tx.create("users", {
                username: "david",
                email: "david@example.com",
                age: 30
            });
            expect(newUser).toBeDefined();
            expect(newUser.lastInsertRowid).toBeGreaterThan(0);

            // Test updateOne method
            const updateResult = await tx.updateOne("users", 
                { age: 29 }, 
                { username: "alice" }
            );
            expect(updateResult.changes).toBe(1);

            // Test deleteOne method
            const deleteResult = await tx.deleteOne("users", { username: "charlie" });
            expect(deleteResult.changes).toBe(1);
        });
    });

    test("should have access to schema methods in transaction", async () => {
        await db.transaction(async (tx) => {
            // Test schema methods
            const hasUsersTable = await tx.schema.hasTable("users");
            expect(hasUsersTable).toBe(true);

            const hasPostsTable = await tx.schema.hasTable("posts");
            expect(hasPostsTable).toBe(true);

            const userColumns = await tx.schema.getTableInfo("users");
            expect(userColumns).toHaveLength(6); // id, username, email, age, is_active, created_at

            const foreignKeys = await tx.schema.getForeignKeys("posts");
            expect(foreignKeys).toHaveLength(1);
            expect(foreignKeys[0]!.column).toBe("user_id");
        });
    });

    test("should have access to utility methods in transaction", async () => {
        await db.transaction(async (tx) => {
            // Test enableForeignKeys method
            tx.enableForeignKeys();
            expect(tx.areForeignKeysEnabled()).toBe(true);

            // Test isTransaction property
            expect(tx.isTransaction).toBe(true);
        });
    });

    test("should have access to query builder methods in transaction", async () => {
        await db.transaction(async (tx) => {
            // Test select query
            const users = await tx.select()
                .from("users")
                .where({ is_active: true })
                .execute<TestUser>();
            expect(users).toHaveLength(2);

            // Test insert query
            const insertResult = await tx.insert("users")
                .values({
                    username: "eve",
                    email: "eve@example.com",
                    age: 25
                })
                .execute();
            expect(insertResult.lastInsertRowid).toBeGreaterThan(0);

            // Test update query
            const updateResult = await tx.update("users")
                .set({ age: 26 })
                .where({ username: "eve" })
                .execute();
            expect(updateResult.changes).toBe(1);

            // Test delete query
            const deleteResult = await tx.delete("users")
                .where({ username: "eve" })
                .execute();
            expect(deleteResult.changes).toBe(1);
        });
    });

    test("should be able to use all methods in nested transactions", async () => {
        await db.transaction(async (outerTx) => {
            // Use convenience methods in outer transaction
            const user = await outerTx.create("users", {
                username: "frank",
                email: "frank@example.com",
                age: 30
            });

            // Nested transaction with all methods
            await outerTx.transaction(async (innerTx) => {
                // Raw SQL
                const result = innerTx.get<{ count: number }>("SELECT COUNT(*) as count FROM users");
                expect(result?.count).toBeGreaterThan(0);

                // Convenience methods
                const frank = await innerTx.findOne<TestUser>("users", { username: "frank" });
                expect(frank).toBeDefined();

                // Query builder
                const posts = await innerTx.insert("posts")
                    .values({
                        user_id: user.lastInsertRowid,
                        title: "Nested Transaction Post",
                        content: "Created in nested transaction",
                        status: "published"
                    })
                    .execute();
                expect(posts.lastInsertRowid).toBeGreaterThan(0);

                // Schema methods
                const hasTable = await innerTx.schema.hasTable("posts");
                expect(hasTable).toBe(true);

                // Utility methods
                expect(innerTx.isTransaction).toBe(true);
            });
        });
    });

    test("should maintain transaction state across all methods", async () => {
        await db.transaction(async (tx) => {
            // All methods should work within the transaction
            expect(tx.isTransaction).toBe(true);

            // Test that we can use any method
            const users = await tx.find<TestUser>("users");
            expect(users).toHaveLength(3);

            const alice = await tx.findOne<TestUser>("users", { username: "alice" });
            expect(alice).toBeDefined();

            const newUser = await tx.create("users", {
                username: "grace",
                email: "grace@example.com"
            });
            expect(newUser).toBeDefined();

            const updateResult = await tx.updateOne("users", 
                { age: 28 }, 
                { username: "grace" }
            );
            expect(updateResult.changes).toBe(1);

            const deleteResult = await tx.deleteOne("users", { username: "grace" });
            expect(deleteResult.changes).toBe(1);

            // Raw SQL should also work
            const count = tx.get<{ count: number }>("SELECT COUNT(*) as count FROM users");
            expect(count?.count).toBe(3);

            // Schema introspection should work
            const hasUsers = await tx.schema.hasTable("users");
            expect(hasUsers).toBe(true);
        });
    });

    // Clean up
    cleanupTestDatabase(db);
});