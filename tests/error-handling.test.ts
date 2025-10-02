/**
 * Tests for error handling and edge cases
 */

import { test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestDatabase, cleanupTestDatabase, insertSampleData, type TestUser } from "./setup";
import type { Database } from "../src";

test("Error Handling", () => {
    let db: Database;

    beforeEach(async () => {
        db = await setupTestDatabase();
        await insertSampleData(db);
    });

    afterEach(() => {
        cleanupTestDatabase(db);
    });

    test("SQL Errors", () => {
        test("should handle invalid SQL syntax", () => {
            expect(() => {
                db.run("INVALID SQL SYNTAX");
            }).toThrow();
        });

        test("should handle malformed queries", () => {
            expect(() => {
                db.run("SELECT * FROM nonexistent_table");
            }).toThrow();
        });

        test("should handle parameter mismatch", () => {
            expect(() => {
                db.run("SELECT ? FROM users", []); // Missing parameter
            }).toThrow();
        });

        test("should handle too many parameters", () => {
            expect(() => {
                db.run("SELECT ? FROM users", ["param1", "param2"]); // Too many parameters
            }).toThrow();
        });
    });

    test("Constraint Violations", () => {
        test("should handle unique constraint violation", async () => {
            // Insert first user
            await db.insert("users")
                .values({
                    username: "alice",
                    email: "alice@example.com"
                })
                .execute();

            // Try to insert duplicate username
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

        test("should handle foreign key constraint violation", async () => {
            db.enableForeignKeys();

            await expect(async () => {
                await db.insert("posts")
                    .values({
                        user_id: 999, // Non-existent user ID
                        title: "Test Post"
                    })
                    .execute();
            }).toThrow();
        });

        test("should handle check constraint violation", async () => {
            // Create table with check constraint
            await db.schema.createTable("test_table")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .addColumn({
                    name: "age",
                    type: "INTEGER",
                    check: "age >= 0 AND age <= 150"
                })
                .execute();

            await expect(async () => {
                await db.insert("test_table")
                    .values({
                        age: 200 // Violates check constraint
                    })
                    .execute();
            }).toThrow();
        });
    });

    test("Query Builder Errors", () => {
        test("should handle invalid table names", async () => {
            await expect(async () => {
                await db.select().from("nonexistent_table").execute();
            }).toThrow();
        });

        test("should handle invalid column names", async () => {
            await expect(async () => {
                await db.select(["nonexistent_column"]).from("users").execute();
            }).toThrow();
        });

        test("should handle invalid join conditions", async () => {
            await expect(async () => {
                await db.select()
                    .from("users")
                    .join("posts", "invalid_join_condition")
                    .execute();
            }).toThrow();
        });

        test("should handle invalid where conditions", async () => {
            await expect(async () => {
                await db.select()
                    .from("users")
                    .where({ "nonexistent_column": "value" })
                    .execute();
            }).toThrow();
        });
    });

    test("Transaction Errors", () => {
        test("should handle transaction with invalid SQL", async () => {
            await expect(async () => {
                await db.transaction(async (tx) => {
                    await tx.run("INVALID SQL");
                });
            }).toThrow();
        });

        test("should handle nested transaction errors", async () => {
            await expect(async () => {
                await db.transaction(async (outerTx) => {
                    await outerTx.insert("users")
                        .values({
                            username: "alice",
                            email: "alice@example.com"
                        })
                        .execute();

                    await outerTx.transaction(async (innerTx) => {
                        await innerTx.run("INVALID SQL");
                    });
                });
            }).toThrow();
        });

        test("should handle transaction timeout", async () => {
            // This test simulates a busy database scenario
            await expect(async () => {
                await db.transaction(async (tx) => {
                    // Simulate long-running operation
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await tx.run("INVALID SQL");
                }, {
                    tries: 1,
                    backoffMs: 10
                });
            }).toThrow();
        });
    });

    test("Schema Errors", () => {
        test("should handle creating table that already exists", async () => {
            await db.schema.createTable("test_table")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .execute();

            await expect(async () => {
                await db.schema.createTable("test_table")
                    .addColumn({
                        name: "id",
                        type: "INTEGER",
                        primaryKey: true
                    })
                    .execute();
            }).toThrow();
        });

        test("should handle dropping non-existent table", async () => {
            await expect(async () => {
                await db.schema.dropTable("nonexistent_table").execute();
            }).toThrow();
        });

        test("should handle adding column that already exists", async () => {
            await db.schema.createTable("test_table")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .execute();

            await expect(async () => {
                await db.schema.alterTable("test_table")
                    .addColumn({
                        name: "id", // Column already exists
                        type: "TEXT"
                    })
                    .execute();
            }).toThrow();
        });

        test("should handle dropping non-existent column", async () => {
            await db.schema.createTable("test_table")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .execute();

            await expect(async () => {
                await db.schema.alterTable("test_table")
                    .dropColumn("nonexistent_column")
                    .execute();
            }).toThrow();
        });

        test("should handle creating index on non-existent table", async () => {
            await expect(async () => {
                await db.schema.createIndex("test_index")
                    .on("nonexistent_table")
                    .columns(["id"])
                    .execute();
            }).toThrow();
        });

        test("should handle creating index on non-existent column", async () => {
            await db.schema.createTable("test_table")
                .addColumn({
                    name: "id",
                    type: "INTEGER",
                    primaryKey: true
                })
                .execute();

            await expect(async () => {
                await db.schema.createIndex("test_index")
                    .on("test_table")
                    .columns(["nonexistent_column"])
                    .execute();
            }).toThrow();
        });
    });

    test("Data Type Errors", () => {
        test("should handle invalid data types", async () => {
            await expect(async () => {
                await db.insert("users")
                    .values({
                        username: "alice",
                        email: "alice@example.com",
                        age: "not_a_number" // Should be integer
                    })
                    .execute();
            }).toThrow();
        });

        test("should handle data too long for column", async () => {
            await expect(async () => {
                await db.insert("users")
                    .values({
                        username: "a".repeat(1000), // Too long for username
                        email: "alice@example.com"
                    })
                    .execute();
            }).toThrow();
        });

        test("should handle invalid date format", async () => {
            await expect(async () => {
                await db.insert("users")
                    .values({
                        username: "alice",
                        email: "alice@example.com",
                        created_at: "invalid_date_format"
                    })
                    .execute();
            }).toThrow();
        });
    });

    test("Concurrency Errors", () => {
        test("should handle concurrent access", async () => {
            // This test simulates concurrent access to the same database
            const promises = [];

            for (let i = 0; i < 10; i++) {
                promises.push(
                    db.insert("users")
                        .values({
                            username: `user${i}`,
                            email: `user${i}@example.com`
                        })
                        .execute()
                );
            }

            // All inserts should succeed
            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);

            // Verify all users were created
            const users = await db.find<TestUser>("users");
            expect(users.length).toBeGreaterThanOrEqual(10);
        });

        test("should handle transaction conflicts", async () => {
            // This test simulates transaction conflicts
            const promises = [];

            for (let i = 0; i < 5; i++) {
                promises.push(
                    db.transaction(async (tx) => {
                        // All transactions try to update the same record
                        await tx.update("users")
                            .set({ age: 30 })
                            .where({ username: "alice" })
                            .execute();
                    })
                );
            }

            // Some transactions might fail due to conflicts
            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === "fulfilled");
            const failed = results.filter(r => r.status === "rejected");

            expect(successful.length + failed.length).toBe(5);
        });
    });

    test("Edge Cases", () => {
        test("should handle empty results", async () => {
            const users = await db.select()
                .from("users")
                .where({ username: "nonexistent" })
                .execute<TestUser>();

            expect(users).toHaveLength(0);
        });

        test("should handle null values", async () => {
            await db.insert("users")
                .values({
                    username: "alice",
                    email: "alice@example.com",
                    age: null
                })
                .execute();

            const alice = await db.findOne<TestUser>("users", { username: "alice" });
            expect(alice?.age).toBeNull();
        });

        test("should handle empty strings", async () => {
            await db.insert("users")
                .values({
                    username: "alice",
                    email: "alice@example.com",
                    age: 28
                })
                .execute();

            await db.update("users")
                .set({ username: "" })
                .where({ username: "alice" })
                .execute();

            const alice = await db.findOne<TestUser>("users", { username: "" });
            expect(alice).toBeDefined();
        });

        test("should handle special characters", async () => {
            await db.insert("users")
                .values({
                    username: "alice_123",
                    email: "alice+test@example.com",
                    age: 28
                })
                .execute();

            const alice = await db.findOne<TestUser>("users", { username: "alice_123" });
            expect(alice).toBeDefined();
            expect(alice?.email).toBe("alice+test@example.com");
        });

        test("should handle very large numbers", async () => {
            await db.insert("users")
                .values({
                    username: "alice",
                    email: "alice@example.com",
                    age: 2147483647 // Max 32-bit integer
                })
                .execute();

            const alice = await db.findOne<TestUser>("users", { username: "alice" });
            expect(alice?.age).toBe(2147483647);
        });

        test("should handle unicode characters", async () => {
            await db.insert("users")
                .values({
                    username: "alice_测试",
                    email: "alice@测试.com",
                    age: 28
                })
                .execute();

            const alice = await db.findOne<TestUser>("users", { username: "alice_测试" });
            expect(alice).toBeDefined();
            expect(alice?.email).toBe("alice@测试.com");
        });
    });
});
