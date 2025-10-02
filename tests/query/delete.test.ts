/**
 * Tests for the DELETE query builder
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser, type TestPost } from "../setup";

test("DELETE Query Builder", () => {
    let db: any;

    beforeEach(async () => {
        db = await setupTestDatabase();
        await insertSampleData(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should delete single record", async () => {
        const result = await db.delete("users")
            .where({ username: "alice" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the deletion
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(alice).toBeUndefined();
    });

    test("should delete multiple records", async () => {
        const result = await db.delete("users")
            .where({ is_active: true })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(2);
        
        // Verify the deletion
        const activeUsers = await db.select()
            .from("users")
            .where({ is_active: true })
            .execute<TestUser>();
        
        expect(activeUsers).toHaveLength(0);
    });

    test("should delete with raw where conditions", async () => {
        const result = await db.delete("users")
            .whereRaw("age > ?", [30])
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the deletion
        const bob = await db.select()
            .from("users")
            .where({ username: "bob" })
            .first<TestUser>();
        
        expect(bob).toBeUndefined();
    });

    test("should delete with returning clause", async () => {
        const result = await db.delete("users")
            .where({ username: "alice" })
            .returning(["id", "username"])
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test("should delete with returning all columns", async () => {
        const result = await db.delete("users")
            .where({ username: "alice" })
            .returning("*")
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test("should delete with empty where clause (delete all)", async () => {
        const result = await db.delete("users")
            .where({})
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(3);
        
        // Verify all users are deleted
        const users = await db.select()
            .from("users")
            .execute<TestUser>();
        
        expect(users).toHaveLength(0);
    });

    test("should handle delete with no matching records", async () => {
        const result = await db.delete("users")
            .where({ username: "nonexistent" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(0);
    });

    test("should delete posts", async () => {
        const result = await db.delete("posts")
            .where({ status: "draft" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the deletion
        const draftPosts = await db.select()
            .from("posts")
            .where({ status: "draft" })
            .execute<TestPost>();
        
        expect(draftPosts).toHaveLength(0);
    });

    test("should delete with complex where conditions", async () => {
        const result = await db.delete("users")
            .where({ 
                is_active: true,
                age: 28
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify the deletion
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(alice).toBeUndefined();
    });

    test("should handle cascade delete with foreign keys", async () => {
        db.enableForeignKeys();
        
        // Get alice's ID
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        // Delete alice (should cascade to her posts)
        const result = await db.delete("users")
            .where({ username: "alice" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify alice is deleted
        const deletedAlice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        expect(deletedAlice).toBeUndefined();
        
        // Verify alice's posts are also deleted (cascade)
        const alicePosts = await db.select()
            .from("posts")
            .where({ user_id: alice?.id })
            .execute<TestPost>();
        
        expect(alicePosts).toHaveLength(0);
    });

    test("should generate SQL", () => {
        const query = db.delete("users")
            .where({ username: "alice", is_active: true })
            .returning(["id", "username"]);
        
        const { sql, params } = query.toSQL();
        expect(sql).toContain("DELETE FROM users");
        expect(sql).toContain("WHERE username = ? AND is_active = ?");
        expect(sql).toContain("RETURNING id, username");
        expect(params).toHaveLength(2);
        expect(params[0]).toBe("alice");
        expect(params[1]).toBe(true);
    });

    test("should generate SQL with raw where", () => {
        const query = db.delete("users")
            .whereRaw("age > ?", [30]);
        
        const { sql, params } = query.toSQL();
        expect(sql).toContain("DELETE FROM users");
        expect(sql).toContain("WHERE age > ?");
        expect(params).toHaveLength(1);
        expect(params[0]).toBe(30);
    });

    test("should generate SQL with empty where", () => {
        const query = db.delete("users")
            .where({});
        
        const { sql, params } = query.toSQL();
        expect(sql).toContain("DELETE FROM users");
        expect(sql).not.toContain("WHERE");
        expect(params).toHaveLength(0);
    });

    test("should delete with special characters in where clause", async () => {
        // Insert a user with special characters
        await db.insert("users")
            .values({
                username: "alice_123",
                email: "alice+test@example.com"
            })
            .execute();
        
        const result = await db.delete("users")
            .where({ username: "alice_123" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test("should delete with null values in where clause", async () => {
        // Insert a user with null age
        await db.insert("users")
            .values({
                username: "david",
                email: "david@example.com",
                age: null
            })
            .execute();
        
        const result = await db.delete("users")
            .where({ age: null })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test("should delete with boolean values in where clause", async () => {
        const result = await db.delete("users")
            .where({ is_active: false })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
        
        // Verify charlie (inactive user) is deleted
        const charlie = await db.select()
            .from("users")
            .where({ username: "charlie" })
            .first<TestUser>();
        
        expect(charlie).toBeUndefined();
    });

    test("should handle delete with foreign key constraint", async () => {
        db.enableForeignKeys();
        
        // Try to delete a user that has posts (without cascade)
        const alice = await db.select()
            .from("users")
            .where({ username: "alice" })
            .first<TestUser>();
        
        // This should work because we have CASCADE DELETE
        const result = await db.delete("users")
            .where({ username: "alice" })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test("should delete with multiple conditions using AND", async () => {
        const result = await db.delete("users")
            .where({ 
                username: "alice",
                is_active: true,
                age: 28
            })
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(1);
    });

    test("should handle delete with no where clause (delete all)", async () => {
        const result = await db.delete("posts")
            .where({})
            .execute();
        
        expect(result).toBeDefined();
        expect(result.changes).toBe(3);
        
        // Verify all posts are deleted
        const posts = await db.select()
            .from("posts")
            .execute<TestPost>();
        
        expect(posts).toHaveLength(0);
    });
});
