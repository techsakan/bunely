/**
 * Test setup utilities for Bunely tests
 */

import { Database as SQLiteDatabase } from "bun:sqlite";
import { createMemoryDatabase, createFileDatabase, Database } from "../src/index";

/**
 * Create a test database instance
 */
export function createTestDatabase(): Database {
    return createMemoryDatabase();
}

/**
 * Create a test database with a specific name for file-based tests
 */
export function createTestFileDatabase(filename: string): Database {
    return createFileDatabase(filename);
}

/**
 * Setup a test database with sample tables and data
 */
export async function setupTestDatabase(): Promise<Database> {
    const db = createTestDatabase();
    db.enableForeignKeys();

    // Create users table
    await db.schema.createTable("users")
        .ifNotExists(true)
        .addColumn({
            name: "id",
            type: "INTEGER",
            primaryKey: true,
            autoIncrement: true
        })
        .addColumn({
            name: "username",
            type: "TEXT",
            notNull: true,
            unique: true
        })
        .addColumn({
            name: "email",
            type: "TEXT",
            notNull: true,
            unique: true
        })
        .addColumn({
            name: "age",
            type: "INTEGER"
        })
        .addColumn({
            name: "is_active",
            type: "BOOLEAN",
            defaultValue: true
        })
        .addColumn({
            name: "created_at",
            type: "DATETIME",
            defaultValue: "CURRENT_TIMESTAMP"
        })
        .execute();

    // Create posts table
    await db.schema.createTable("posts")
        .ifNotExists(true)
        .addColumn({
            name: "id",
            type: "INTEGER",
            primaryKey: true,
            autoIncrement: true
        })
        .addColumn({
            name: "user_id",
            type: "INTEGER",
            notNull: true
        })
        .addColumn({
            name: "title",
            type: "TEXT",
            notNull: true
        })
        .addColumn({
            name: "content",
            type: "TEXT"
        })
        .addColumn({
            name: "status",
            type: "TEXT",
            defaultValue: "draft"
        })
        .addColumn({
            name: "created_at",
            type: "DATETIME",
            defaultValue: "CURRENT_TIMESTAMP"
        })
        .addForeignKey({
            column: "user_id",
            references: {
                table: "users",
                column: "id"
            },
            onDelete: "CASCADE"
        })
        .execute();

    // Create comments table
    await db.schema.createTable("comments")
        .ifNotExists(true)
        .addColumn({
            name: "id",
            type: "INTEGER",
            primaryKey: true,
            autoIncrement: true
        })
        .addColumn({
            name: "post_id",
            type: "INTEGER",
            notNull: true
        })
        .addColumn({
            name: "user_id",
            type: "INTEGER",
            notNull: true
        })
        .addColumn({
            name: "content",
            type: "TEXT",
            notNull: true
        })
        .addColumn({
            name: "created_at",
            type: "DATETIME",
            defaultValue: "CURRENT_TIMESTAMP"
        })
        .addForeignKey({
            column: "post_id",
            references: {
                table: "posts",
                column: "id"
            },
            onDelete: "CASCADE"
        })
        .addForeignKey({
            column: "user_id",
            references: {
                table: "users",
                column: "id"
            },
            onDelete: "CASCADE"
        })
        .execute();

    // Create indexes
    await db.schema.createIndex("idx_users_email")
        .on("users")
        .columns(["email"])
        .unique(true)
        .ifNotExists(true)
        .execute();

    await db.schema.createIndex("idx_posts_user_id")
        .on("posts")
        .columns(["user_id"])
        .ifNotExists(true)
        .execute();

    await db.schema.createIndex("idx_posts_status")
        .on("posts")
        .columns(["status"])
        .ifNotExists(true)
        .execute();

    return db;
}

/**
 * Insert sample data for testing
 */
export async function insertSampleData(db: Database): Promise<void> {
    // Insert users
    await db.insert("users").values({
        username: "alice",
        email: "alice@example.com",
        age: 28,
        is_active: true
    }).execute();

    await db.insert("users").values({
        username: "bob",
        email: "bob@example.com",
        age: 32,
        is_active: true
    }).execute();

    await db.insert("users").values({
        username: "charlie",
        email: "charlie@example.com",
        age: 25,
        is_active: false
    }).execute();

    // Insert posts
    const users = await db.select().from("users").execute();
    const alice = users.find(u => u.username === "alice");
    const bob = users.find(u => u.username === "bob");

    if (alice) {
        await db.insert("posts").values({
            user_id: alice.id,
            title: "Getting Started with Bunely",
            content: "This is a great library!",
            status: "published"
        }).execute();

        await db.insert("posts").values({
            user_id: alice.id,
            title: "Advanced Patterns",
            content: "Here are some advanced patterns...",
            status: "draft"
        }).execute();
    }

    if (bob) {
        await db.insert("posts").values({
            user_id: bob.id,
            title: "SQLite Best Practices",
            content: "Some best practices for SQLite...",
            status: "published"
        }).execute();
    }
}

/**
 * Clean up test database
 */
export function cleanupTestDatabase(db: Database | undefined): void {
    if (db) {
        db.close();
    }
}

/**
 * Test data types for type checking
 */
export interface TestUser {
    id?: number;
    username: string;
    email: string;
    age?: number;
    is_active?: boolean;
    created_at?: string;
}

export interface TestPost {
    id?: number;
    user_id: number;
    title: string;
    content?: string;
    status?: string;
    created_at?: string;
}

export interface TestComment {
    id?: number;
    post_id: number;
    user_id: number;
    content: string;
    created_at?: string;
}
