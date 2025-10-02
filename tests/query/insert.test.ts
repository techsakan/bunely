/**
 * Tests for the INSERT query builder
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, type TestUser, type TestPost } from "../setup";

test("INSERT Query Builder", () => {
    let db: any;

    beforeEach(async () => {
        db = await setupTestDatabase();
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should insert single record", async () => {
        const result = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                age: 28
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(1);
    });

    test("should insert multiple records", async () => {
        const result = await db.insert("users")
            .values([
                {
                    username: "alice",
                    email: "alice@example.com",
                    age: 28
                },
                {
                    username: "bob",
                    email: "bob@example.com",
                    age: 32
                }
            ])
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(2);
    });

    test("should insert with returning clause", async () => {
        const result = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                age: 28
            })
            .returning(["id", "username"])
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(1);
    });

    test("should insert with returning all columns", async () => {
        const result = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                age: 28
            })
            .returning("*")
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(1);
    });

    test("should insert with default values", async () => {
        const result = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com"
                // age and is_active will use defaults
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(1);
        
        // Verify the record was inserted with defaults
        const user = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(user?.is_active).toBe(true);
        expect(user?.created_at).toBeDefined();
    });

    test("should insert with null values", async () => {
        const result = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                age: null
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(1);
    });

    test("should insert with foreign key relationship", async () => {
        // First insert a user
        const userResult = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com"
            })
            .execute();
        
        // Then insert a post for that user
        const postResult = await db.insert("posts")
            .values({
                user_id: userResult.lastInsertRowid,
                title: "My First Post",
                content: "This is my first post!",
                status: "published"
            })
            .execute();
        
        expect(postResult).toBeDefined();
        expect(postResult.lastInsertRowid).toBeGreaterThan(0);
        expect(postResult.changes).toBe(1);
    });

    test("should handle foreign key constraint violation", async () => {
        db.enableForeignKeys();
        
        // Try to insert a post with non-existent user_id
        await expect(async () => {
            await db.insert("posts")
                .values({
                    user_id: 999,
                    title: "Test Post"
                })
                .execute();
        }).toThrow();
    });

    test("should handle unique constraint violation", async () => {
        // Insert first user
        await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com"
            })
            .execute();
        
        // Try to insert another user with same username
        await expect(async () => {
            await db.insert("users")
                .values({
                    username: "alice",
                    email: "different@example.com"
                })
                .execute();
        }).toThrow();
    });

    test("should handle not null constraint violation", async () => {
        await expect(async () => {
            await db.insert("users")
                .values({
                    // username is required but missing
                    email: "alice@example.com"
                })
                .execute();
        }).toThrow();
    });

    test("should generate SQL", () => {
        const query = db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                age: 28
            })
            .returning(["id", "username"]);
        
        const { sql, params } = query.toSQL();
        expect(sql).toContain("INSERT INTO users");
        expect(sql).toContain("(username, email, age)");
        expect(sql).toContain("VALUES (?, ?, ?)");
        expect(sql).toContain("RETURNING id, username");
        expect(params).toHaveLength(3);
        expect(params[0]).toBe("alice");
        expect(params[1]).toBe("alice@example.com");
        expect(params[2]).toBe(28);
    });

    test("should generate SQL for multiple values", () => {
        const query = db.insert("users")
            .values([
                { username: "alice", email: "alice@example.com" },
                { username: "bob", email: "bob@example.com" }
            ]);
        
        const { sql, params } = query.toSQL();
        expect(sql).toContain("INSERT INTO users");
        expect(sql).toContain("(username, email)");
        expect(sql).toContain("VALUES (?, ?), (?, ?)");
        expect(params).toHaveLength(4);
    });

    test("should insert with special characters", async () => {
        const result = await db.insert("users")
            .values({
                username: "alice_123",
                email: "alice+test@example.com",
                age: 28
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(1);
    });

    test("should insert with boolean values", async () => {
        const result = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                is_active: false
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(1);
        
        // Verify the boolean value was stored correctly
        const user = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(user?.is_active).toBe(false);
    });

    test("should insert with datetime values", async () => {
        const now = new Date().toISOString();
        const result = await db.insert("users")
            .values({
                username: "alice",
                email: "alice@example.com",
                created_at: now
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.lastInsertRowid).toBeGreaterThan(0);
        expect(result.changes).toBe(1);
        
        // Verify the datetime value was stored correctly
        const user = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(user?.created_at).toBe(now);
    });
});
