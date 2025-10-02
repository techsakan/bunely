/**
 * Tests for the core Database class
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { Database as SQLiteDatabase } from "bun:sqlite";
import { createMemoryDatabase, createFileDatabase, createDatabase, Database } from "../src/index";
import { createTestDatabase, setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser } from "./setup";

test("Database Creation", () => {
    test("should create memory database", () => {
        const db = createMemoryDatabase();
        expect(db).toBeInstanceOf(Database);
        expect(db.isTransaction).toBe(false);
        db.close();
    });

    test("should create file database", () => {
        const db = createFileDatabase("test.db");
        expect(db).toBeInstanceOf(Database);
        expect(db.isTransaction).toBe(false);
        db.close();
    });

    test("should create database from existing SQLite instance", () => {
        const sqliteDb = new SQLiteDatabase(":memory:");
        const db = createDatabase(sqliteDb);
        expect(db).toBeInstanceOf(Database);
        expect(db.isTransaction).toBe(false);
        db.close();
    });

    test("should create database with options", () => {
        const db = createMemoryDatabase({ busyTimeoutMs: 5000 });
        expect(db).toBeInstanceOf(Database);
        db.close();
    });
});

test("Database Core Functionality", () => {
    let db: Database;

    beforeEach(async () => {
        db = await setupTestDatabase();
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should enable foreign keys", () => {
        db.enableForeignKeys();
        expect(db.areForeignKeysEnabled()).toBe(true);
    });

    test("should check foreign keys status", () => {
        expect(db.areForeignKeysEnabled()).toBe(false);
        db.enableForeignKeys();
        expect(db.areForeignKeysEnabled()).toBe(true);
    });

    test("should execute raw SQL", () => {
        const result = db.run("SELECT 1 as test");
        expect(result).toBeDefined();
    });

    test("should get single row with raw SQL", () => {
        const result = db.get<{ test: number }>("SELECT 42 as test");
        expect(result?.test).toBe(42);
    });

    test("should get all rows with raw SQL", () => {
        const result = db.all<{ test: number }>("SELECT 1 as test UNION SELECT 2 as test");
        expect(result).toHaveLength(2);
        expect(result[0]!.test).toBe(1);
        expect(result[1]!.test).toBe(2);
    });

    test("should execute raw SQL with parameters", () => {
        const result = db.get<{ test: number }>("SELECT ? as test", [42]);
        expect(result?.test).toBe(42);
    });
});

test("Convenience Methods", () => {
    let db: Database;

    beforeEach(async () => {
        db = await setupTestDatabase();
        await insertSampleData(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should find records", async () => {
        const users = await db.find<TestUser>("users");
        expect(users).toHaveLength(3);
        expect(users[0]).toHaveProperty("username");
        expect(users[0]).toHaveProperty("email");
    });

    test("should find records with conditions", async () => {
        const activeUsers = await db.find<TestUser>("users", { is_active: true });
        expect(activeUsers).toHaveLength(2);
        
        const alice = await db.find<TestUser>("users", { username: "alice" });
        expect(alice).toHaveLength(1);
        expect(alice[0]!.username).toBe("alice");
    });

    test("should find one record", async () => {
        const alice = await db.findOne<TestUser>("users", { username: "alice" });
        expect(alice).toBeDefined();
        expect(alice?.username).toBe("alice");
    });

    test("should return undefined when no record found", async () => {
        const user = await db.findOne<TestUser>("users", { username: "nonexistent" });
        expect(user).toBeUndefined();
    });

    test("should create record", async () => {
        const result = await db.create("users", {
            username: "david",
            email: "david@example.com",
            age: 30
        });
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    test("should update one record", async () => {
        const result = await db.updateOne("users", 
            { age: 29 }, 
            { username: "alice" }
        );
        expect(result.changes).toBe(1);
        
        const alice = await db.findOne<TestUser>("users", { username: "alice" });
        expect(alice?.age).toBe(29);
    });

    test("should delete one record", async () => {
        const result = await db.deleteOne("users", { username: "charlie" });
        expect(result.changes).toBe(1);
        
        const charlie = await db.findOne<TestUser>("users", { username: "charlie" });
        expect(charlie).toBeUndefined();
    });
});

test("Database Error Handling", () => {
    let db: Database;

    beforeEach(async () => {
        db = await setupTestDatabase();
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should handle invalid SQL gracefully", () => {
        expect(() => {
            db.run("INVALID SQL");
        }).toThrow();
    });

    test("should handle foreign key constraint violations", async () => {
        db.enableForeignKeys();
        
        // Try to insert a post with non-existent user_id
        expect(async () => {
            await db.insert("posts").values({
                user_id: 999,
                title: "Test Post"
            }).execute();
        }).toThrow();
    });

    test("should handle unique constraint violations", async () => {
        await db.insert("users").values({
            username: "alice",
            email: "alice@example.com"
        }).execute();

        // Try to insert another user with same username
        expect(async () => {
            await db.insert("users").values({
                username: "alice",
                email: "different@example.com"
            }).execute();
        }).toThrow();
    });
});

test("Database Transaction State", () => {
    test("should identify transaction state", () => {
        const db = createMemoryDatabase();
        expect(db.isTransaction).toBe(false);
        db.close();
    });
});
