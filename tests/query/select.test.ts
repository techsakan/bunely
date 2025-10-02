/**
 * Tests for the SELECT query builder
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser, type TestPost } from "../setup";
import type { Database } from "../../src";

test("SELECT Query Builder", () => {
    let db: Database;

    beforeEach(async () => {
        db = await setupTestDatabase();
        await insertSampleData(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("should select all columns", async () => {
        const users = await db.select().from("users").execute<TestUser>();
        expect(users).toHaveLength(3);
        expect(users[0]).toHaveProperty("id");
        expect(users[0]).toHaveProperty("username");
        expect(users[0]).toHaveProperty("email");
    });

    test("should select specific columns", async () => {
        const users = await db.select(["username", "email"]).from("users").execute();
        expect(users).toHaveLength(3);
        expect(users[0]).toHaveProperty("username");
        expect(users[0]).toHaveProperty("email");
        expect(users[0]).not.toHaveProperty("id");
    });

    test("should select with where conditions", async () => {
        const alice = await db.select().from("users").where({ username: "alice" }).execute<TestUser>();
        expect(alice).toHaveLength(1);
        expect(alice[0]!.username).toBe("alice");
    });

    test("should select with multiple where conditions", async () => {
        const activeUsers = await db.select()
            .from("users")
            .where({ is_active: true })
            .execute<TestUser>();
        expect(activeUsers).toHaveLength(2);
    });

    test("should select with raw where conditions", async () => {
        const adultUsers = await db.select()
            .from("users")
            .whereRaw("age >= ?", [25])
            .execute<TestUser>();
        expect(adultUsers).toHaveLength(2);
    });

    test("should select with order by", async () => {
        const users = await db.select()
            .from("users")
            .orderBy(["username ASC"])
            .execute<TestUser>();
        expect(users[0]!.username).toBe("alice");
        expect(users[1]!.username).toBe("bob");
        expect(users[2]!.username).toBe("charlie");
    });

    test("should select with multiple order by columns", async () => {
        const users = await db.select()
            .from("users")
            .orderBy(["is_active DESC", "username ASC"])
            .execute<TestUser>();
        // Active users first, then inactive, sorted by username
        expect(users[0]!.is_active).toBe(true);
        expect(users[1]!.is_active).toBe(true);
        expect(users[2]!.is_active).toBe(false);
    });

    test("should select with limit", async () => {
        const users = await db.select()
            .from("users")
            .limit(2)
            .execute<TestUser>();
        expect(users).toHaveLength(2);
    });

    test("should select with offset", async () => {
        const users = await db.select()
            .from("users")
            .orderBy(["id ASC"])
            .limit(1)
            .offset(1)
            .execute<TestUser>();
        expect(users).toHaveLength(1);
        expect(users[0]!.username).toBe("bob");
    });

    test("should select with group by", async () => {
        const statusCounts = await db.select([
            "status",
            "COUNT(*) as count"
        ])
            .from("posts")
            .groupBy(["status"])
            .execute();

        expect(statusCounts).toHaveLength(2);
        const publishedCount = statusCounts.find(s => s.status === "published");
        const draftCount = statusCounts.find(s => s.status === "draft");
        expect(publishedCount?.count).toBe(2);
        expect(draftCount?.count).toBe(1);
    });

    test("should select with having", async () => {
        const statusCounts = await db.select([
            "status",
            "COUNT(*) as count"
        ])
            .from("posts")
            .groupBy(["status"])
            .having({ count: 2 })
            .execute();

        expect(statusCounts).toHaveLength(1);
        expect(statusCounts[0].status).toBe("published");
    });

    test("should select with inner join", async () => {
        const postsWithUsers = await db.select([
            "p.title",
            "u.username"
        ])
            .from("posts as p")
            .join("users as u", "p.user_id = u.id")
            .execute();

        expect(postsWithUsers).toHaveLength(3);
        expect(postsWithUsers[0]).toHaveProperty("title");
        expect(postsWithUsers[0]).toHaveProperty("username");
    });

    test("should select with left join", async () => {
        const usersWithPosts = await db.select([
            "u.username",
            "p.title"
        ])
            .from("users as u")
            .leftJoin("posts as p", "u.id = p.user_id")
            .execute();

        expect(usersWithPosts).toHaveLength(4); // 3 users, but alice has 2 posts
    });

    test("should select with right join", async () => {
        const postsWithUsers = await db.select([
            "p.title",
            "u.username"
        ])
            .from("posts as p")
            .rightJoin("users as u", "p.user_id = u.id")
            .execute();

        expect(postsWithUsers).toHaveLength(4);
    });

    test("should get first record", async () => {
        const firstUser = await db.select()
            .from("users")
            .orderBy(["id ASC"])
            .first<TestUser>();

        expect(firstUser).toBeDefined();
        expect(firstUser?.username).toBe("alice");
    });

    test("should return undefined for first when no records", async () => {
        const user = await db.select()
            .from("users")
            .where({ username: "nonexistent" })
            .first<TestUser>();

        expect(user).toBeUndefined();
    });

    test("should count records", async () => {
        const userCount = await db.select()
            .from("users")
            .count();

        expect(userCount).toBe(3);
    });

    test("should count records with conditions", async () => {
        const activeUserCount = await db.select()
            .from("users")
            .where({ is_active: true })
            .count();

        expect(activeUserCount).toBe(2);
    });

    test("should generate SQL", () => {
        const query = db.select(["username", "email"])
            .from("users")
            .where({ is_active: true })
            .orderBy(["username ASC"])
            .limit(10);

        const { sql, params } = query.toSQL();
        expect(sql).toContain("SELECT username, email");
        expect(sql).toContain("FROM users");
        expect(sql).toContain("WHERE is_active = ?");
        expect(sql).toContain("ORDER BY username ASC");
        expect(sql).toContain("LIMIT 10");
        expect(params).toHaveLength(1);
        expect(params[0]).toBe(true);
    });

    test("should handle complex queries", async () => {
        const result = await db.select([
            "u.username",
            "COUNT(p.id) as post_count"
        ])
            .from("users as u")
            .leftJoin("posts as p", "u.id = p.user_id")
            .where({ "u.is_active": true })
            .groupBy(["u.id", "u.username"])
            .having({ post_count: 1 })
            .orderBy(["post_count DESC"])
            .execute();

        expect(result).toHaveLength(1);
        expect(result[0].username).toBe("bob");
        expect(result[0].post_count).toBe(1);
    });
});
