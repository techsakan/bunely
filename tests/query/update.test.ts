/**
 * Tests for the UPDATE query builder
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser, type TestPost } from "../setup";

test("UPDATE Query Builder", () => {
    let db: any;

    beforeEach(async () => {
        db = await setupTestDatabase();
        await insertSampleData(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should update single record", async () => {
        const result = await db.update("users")
            .set({ age: 29 })
            .where({ username: "alice" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the update
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(alice?.age).toBe(29);
    });

    test("should update multiple fields", async () => {
        const result = await db.update("users")
            .set({ 
                age: 30,
                is_active: false
            })
            .where({ username: "alice" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the update
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(alice?.age).toBe(30);
        expect(alice?.is_active).toBe(false);
    });

    test("should update multiple records", async () => {
        const result = await db.update("users")
            .set({ is_active: false })
            .where({ is_active: true })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(2);
        
        // Verify all active users are now inactive
        const activeUsers = await db.select()
            .from("users")
            .where({ is_active: true })
            .execute<TestUser>();
        
        expect(activeUsers).toHaveLength(0);
    });

    test("should update with raw where conditions", async () => {
        const result = await db.update("users")
            .set({ age: 25 })
            .whereRaw("age > ?", [30])
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the update
        const bob = await db.select()
            .from("users")
            .where({ username: "bob" })
            .first<TestUser>();
        
        expect(bob?.age).toBe(25);
    });

    test("should update with returning clause", async () => {
        const result = await db.update("users")
            .set({ age: 29 })
            .where({ username: "alice" })
            .returning(["id", "username", "age"])
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test("should update with returning all columns", async () => {
        const result = await db.update("users")
            .set({ age: 29 })
            .where({ username: "alice" })
            .returning("*")
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test("should update with null values", async () => {
        const result = await db.update("users")
            .set({ age: null })
            .where({ username: "alice" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the update
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(alice?.age).toBeNull();
    });

    test("should update with boolean values", async () => {
        const result = await db.update("users")
            .set({ is_active: false })
            .where({ username: "alice" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the update
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(alice?.is_active).toBe(false);
    });

    test("should update with datetime values", async () => {
        const now = new Date().toISOString();
        const result = await db.update("users")
            .set({ created_at: now })
            .where({ username: "alice" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the update
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(alice?.created_at).toBe(now);
    });

    test("should update posts status", async () => {
        const result = await db.update("posts")
            .set({ status: "published" })
            .where({ status: "draft" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the update
        const draftPosts = await db.select()
            .from("posts")
            .where({ status: "draft" })
            .execute<TestPost>();
        
        expect(draftPosts).toHaveLength(0);
    });

    test("should handle update with no matching records", async () => {
        const result = await db.update("users")
            .set({ age: 29 })
            .where({ username: "nonexistent" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(0);
    });

    test("should handle update with empty where clause", async () => {
        const result = await db.update("users")
            .set({ is_active: false })
            .where({})
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(3);
        
        // Verify all users are now inactive
        const activeUsers = await db.select()
            .from("users")
            .where({ is_active: true })
            .execute<TestUser>();
        
        expect(activeUsers).toHaveLength(0);
    });

    test("should handle update with complex where conditions", async () => {
        const result = await db.update("users")
            .set({ age: 30 })
            .where({ 
                is_active: true,
                age: 32
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the update
        const bob = await db.select()
            .from("users")
            .where({ username: "bob" })
            .first<TestUser>();
        
        expect(bob?.age).toBe(30);
    });

    test("should generate SQL", () => {
        const query = db.update("users")
            .set({ age: 29, is_active: false })
            .where({ username: "alice" })
            .returning(["id", "username"]);
        
        const { sql, params } = query.toSQL();
        expect(sql).toContain("UPDATE users");
        expect(sql).toContain("SET age = ?, is_active = ?");
        expect(sql).toContain("WHERE username = ?");
        expect(sql).toContain("RETURNING id, username");
        expect(params).toHaveLength(3);
        expect(params[0]).toBe(29);
        expect(params[1]).toBe(false);
        expect(params[2]).toBe("alice");
    });

    test("should generate SQL with raw where", () => {
        const query = db.update("users")
            .set({ age: 29 })
            .whereRaw("age > ?", [30]);
        
        const { sql, params } = query.toSQL();
        expect(sql).toContain("UPDATE users");
        expect(sql).toContain("SET age = ?");
        expect(sql).toContain("WHERE age > ?");
        expect(params).toHaveLength(2);
        expect(params[0]).toBe(29);
        expect(params[1]).toBe(30);
    });

    test("should handle foreign key constraint updates", async () => {
        // Get a user ID
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        // Update a post's user_id to a valid user
        const result = await db.update("posts")
            .set({ user_id: alice?.id })
            .where({ user_id: alice?.id })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBeGreaterThanOrEqual(0);
    });

    test("should handle unique constraint updates", async () => {
        // Try to update username to an existing one
        await expect(async () => {
            await db.update("users")
                .set({ username: "bob" })
                .where({ username: "alice" })
                .execute();
        }).toThrow();
    });

    test("should handle not null constraint updates", async () => {
        // Try to update username to null
        await expect(async () => {
            await db.update("users")
                .set({ username: null })
                .where({ username: "alice" })
                .execute();
        }).toThrow();
    });
});
