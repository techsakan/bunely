/**
 * Tests for explicit where conditions with operators
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser, type TestPost } from "./setup";
import type { Database } from "../src";

test("Explicit Where Conditions", async () => {
    const db = await setupTestDatabase();
    await insertSampleData(db);

    test("should support basic operators", async () => {
        // Test equals
        const alice = await db.select()
            .from("users")
            .where("username", "=", "alice")
            .first<TestUser>();
        expect(alice?.username).toBe("alice");

        // Test not equals
        const notAlice = await db.select()
            .from("users")
            .where("username", "!=", "alice")
            .execute<TestUser>();
        expect(notAlice).toHaveLength(2);

        // Test greater than
        const adults = await db.select()
            .from("users")
            .where("age", ">", 25)
            .execute<TestUser>();
        expect(adults).toHaveLength(2);

        // Test less than or equal
        const youngUsers = await db.select()
            .from("users")
            .where("age", "<=", 25)
            .execute<TestUser>();
        expect(youngUsers).toHaveLength(1);
    });

    test("should support LIKE operators", async () => {
        // Test LIKE
        const aliceUsers = await db.select()
            .from("users")
            .where("username", "LIKE", "alice%")
            .execute<TestUser>();
        expect(aliceUsers).toHaveLength(1);

        // Test NOT LIKE
        const notAliceUsers = await db.select()
            .from("users")
            .where("username", "NOT LIKE", "alice%")
            .execute<TestUser>();
        expect(notAliceUsers).toHaveLength(2);
    });

    test("should support IN operators", async () => {
        // Test IN
        const specificUsers = await db.select()
            .from("users")
            .where("username", "IN", ["alice", "bob"])
            .execute<TestUser>();
        expect(specificUsers).toHaveLength(2);

        // Test NOT IN
        const otherUsers = await db.select()
            .from("users")
            .where("username", "NOT IN", ["alice", "bob"])
            .execute<TestUser>();
        expect(otherUsers).toHaveLength(1);
    });

    test("should support BETWEEN operators", async () => {
        // Test BETWEEN
        const middleAged = await db.select()
            .from("users")
            .where("age", "BETWEEN", 25, 30)
            .execute<TestUser>();
        expect(middleAged).toHaveLength(2);

        // Test NOT BETWEEN
        const notMiddleAged = await db.select()
            .from("users")
            .where("age", "NOT BETWEEN", 25, 30)
            .execute<TestUser>();
        expect(notMiddleAged).toHaveLength(1);
    });

    test("should support NULL operators", async () => {
        // Insert a user with null age
        await db.insert("users")
            .values({
                username: "nullage",
                email: "nullage@example.com",
                age: null
            })
            .execute();

        // Test IS NULL
        const nullAgeUsers = await db.select()
            .from("users")
            .where("age", "IS NULL", null)
            .execute<TestUser>();
        expect(nullAgeUsers).toHaveLength(1);
        expect(nullAgeUsers[0]!.username).toBe("nullage");

        // Test IS NOT NULL
        const notNullAgeUsers = await db.select()
            .from("users")
            .where("age", "IS NOT NULL", null)
            .execute<TestUser>();
        expect(notNullAgeUsers).toHaveLength(3);
    });

    test("should support multiple where conditions", async () => {
        const result = await db.select()
            .from("users")
            .where("age", ">", 25)
            .where("is_active", "=", true)
            .execute<TestUser>();
        expect(result).toHaveLength(2);
    });

    test("should work with UPDATE queries", async () => {
        const result = await db.update("users")
            .set({ age: 30 })
            .where("username", "=", "alice")
            .execute();
        expect(result.changes).toBe(1);

        // Verify the update
        const alice = await db.select()
            .from("users")
            .where("username", "=", "alice")
            .first<TestUser>();
        expect(alice?.age).toBe(30);
    });

    test("should work with DELETE queries", async () => {
        const result = await db.delete("users")
            .where("username", "=", "charlie")
            .execute();
        expect(result.changes).toBe(1);

        // Verify the deletion
        const charlie = await db.select()
            .from("users")
            .where("username", "=", "charlie")
            .first<TestUser>();
        expect(charlie).toBeUndefined();
    });

    test("should work with complex conditions", async () => {
        const result = await db.select()
            .from("users")
            .where("age", ">", 25)
            .where("username", "IN", ["alice", "bob"])
            .where("is_active", "=", true)
            .execute<TestUser>();
        expect(result).toHaveLength(2);
    });

    test("should generate correct SQL", () => {
        const query = db.select()
            .from("users")
            .where("age", ">", 25)
            .where("username", "LIKE", "alice%")
            .where("is_active", "=", true);

        const { sql, params } = query.toSQL();
        expect(sql).toContain('"age" > ?');
        expect(sql).toContain('"username" LIKE ?');
        expect(sql).toContain('"is_active" = ?');
        expect(params).toEqual([25, "alice%", true]);
    });

    test("should work with transactions", async () => {
        await db.transaction(async (tx) => {
            // Use explicit where in transaction
            const users = await tx.select()
                .from("users")
                .where("age", ">", 25)
                .execute<TestUser>();
            expect(users).toHaveLength(2);

            // Update with explicit where
            await tx.update("users")
                .set({ age: 35 })
                .where("username", "=", "bob")
                .execute();

            // Delete with explicit where
            await tx.delete("users")
                .where("username", "=", "charlie")
                .execute();
        });

        // Verify changes were committed
        const bob = await db.select()
            .from("users")
            .where("username", "=", "bob")
            .first<TestUser>();
        expect(bob?.age).toBe(35);

        const charlie = await db.select()
            .from("users")
            .where("username", "=", "charlie")
            .first<TestUser>();
        expect(charlie).toBeUndefined();
    });

    test("should support all comparison operators", async () => {
        // Test all operators
        const operators = [
            { op: "=", value: 28, expected: 1 },
            { op: "!=", value: 28, expected: 2 },
            { op: "<>", value: 28, expected: 2 },
            { op: "<", value: 30, expected: 2 },
            { op: ">", value: 25, expected: 2 },
            { op: "<=", value: 28, expected: 2 },
            { op: ">=", value: 28, expected: 2 }
        ];

        for (const { op, value, expected } of operators) {
            const result = await db.select()
                .from("users")
                .where("age", op as any, value)
                .execute<TestUser>();
            expect(result).toHaveLength(expected);
        }
    });

    // Clean up
    cleanupTestDatabase(db);
});
