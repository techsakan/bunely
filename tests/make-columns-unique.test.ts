import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDatabase } from "./setup";
import type { Bunely } from "../src";

describe("makeColumnsUnique Functionality", () => {
    let db: Bunely;

    beforeEach(() => {
        db = createTestDatabase();
    });

    test("should create single column unique constraint", async () => {
        await db.schema.createTable('users')
            .addColumn({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true
            })
            .addColumn({
                name: 'email',
                type: 'TEXT',
                notNull: true
            })
            .execute();

        await db.schema.alterTable('users')
            .makeColumnsUnique(['email'])
            .execute();

        const indexes = await db.schema.getIndexes('users');
        const emailIndex = indexes.find(idx => idx.columns.includes('email'));

        expect(emailIndex).toBeDefined();
        expect(emailIndex!.unique).toBe(true);
        expect(emailIndex!.columns).toEqual(['email']);

        const tableInfo = await db.schema.getTableInfo('users');
        const emailColumn = tableInfo.find(col => col.name === 'email');
        expect(emailColumn!.unique).toBe(true);
    });

    test("should create composite unique constraint", async () => {
        await db.schema.createTable('products')
            .addColumn({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true
            })
            .addColumn({
                name: 'category',
                type: 'TEXT',
                notNull: true
            })
            .addColumn({
                name: 'brand',
                type: 'TEXT',
                notNull: true
            })
            .execute();

        await db.schema.alterTable('products')
            .makeColumnsUnique(['category', 'brand'])
            .execute();

        const indexes = await db.schema.getIndexes('products');
        const compositeIndex = indexes.find(idx =>
            idx.columns.includes('category') && idx.columns.includes('brand')
        );

        expect(compositeIndex).toBeDefined();
        expect(compositeIndex!.unique).toBe(true);
        expect(compositeIndex!.columns).toEqual(['category', 'brand']);

        const tableInfo = await db.schema.getTableInfo('products');
        const categoryColumn = tableInfo.find(col => col.name === 'category');
        const brandColumn = tableInfo.find(col => col.name === 'brand');

        // Individual columns should not be marked as unique for composite constraints
        expect(categoryColumn!.unique).toBe(false);
        expect(brandColumn!.unique).toBe(false);
    });

    test("should create multiple unique constraints", async () => {
        await db.schema.createTable('users')
            .addColumn({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true
            })
            .addColumn({
                name: 'email',
                type: 'TEXT',
                notNull: true
            })
            .addColumn({
                name: 'username',
                type: 'TEXT',
                notNull: true
            })
            .addColumn({
                name: 'full_name',
                type: 'TEXT',
                notNull: true
            })
            .execute();

        // First unique constraint
        await db.schema.alterTable('users')
            .makeColumnsUnique(['email'])
            .execute();

        // Second unique constraint
        await db.schema.alterTable('users')
            .makeColumnsUnique(['username', 'full_name'])
            .execute();

        const indexes = await db.schema.getIndexes('users');
        expect(indexes).toHaveLength(2);

        const emailIndex = indexes.find(idx => idx.columns.includes('email'));
        const compositeIndex = indexes.find(idx =>
            idx.columns.includes('username') && idx.columns.includes('full_name')
        );

        expect(emailIndex).toBeDefined();
        expect(emailIndex!.unique).toBe(true);
        expect(emailIndex!.columns).toEqual(['email']);

        expect(compositeIndex).toBeDefined();
        expect(compositeIndex!.unique).toBe(true);
        expect(compositeIndex!.columns).toEqual(['username', 'full_name']);

        const tableInfo = await db.schema.getTableInfo('users');
        const emailColumn = tableInfo.find(col => col.name === 'email');
        const usernameColumn = tableInfo.find(col => col.name === 'username');
        const fullNameColumn = tableInfo.find(col => col.name === 'full_name');

        expect(emailColumn!.unique).toBe(true);
        expect(usernameColumn!.unique).toBe(false);
        expect(fullNameColumn!.unique).toBe(false);
    });

    test("should enforce unique constraints on data insertion", async () => {
        await db.schema.createTable('users')
            .addColumn({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true
            })
            .addColumn({
                name: 'email',
                type: 'TEXT',
                notNull: true
            })
            .addColumn({
                name: 'username',
                type: 'TEXT',
                notNull: true
            })
            .execute();

        await db.schema.alterTable('users')
            .makeColumnsUnique(['email'])
            .execute();

        await db.schema.alterTable('users')
            .makeColumnsUnique(['username'])
            .execute();

        // Insert first record
        await db.insert('users').values({
            id: 1,
            email: 'john@example.com',
            username: 'john'
        }).execute();

        // Test duplicate email (should fail)
        try {
            await db.insert('users').values({
                id: 2,
                email: 'john@example.com', // Duplicate email
                username: 'jane'
            }).execute();
            expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
            expect(error.message).toContain('UNIQUE constraint failed');
        }

        // Test duplicate username (should fail)
        try {
            await db.insert('users').values({
                id: 3,
                email: 'jane@example.com',
                username: 'john' // Duplicate username
            }).execute();
            expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
            expect(error.message).toContain('UNIQUE constraint failed');
        }

        // Test valid insertion (should succeed)
        await db.insert('users').values({
            id: 4,
            email: 'jane@example.com',
            username: 'jane'
        }).execute();
    });

    test("should handle overlapping unique constraints", async () => {
        // This test demonstrates the behavior when you have both individual and composite
        // unique constraints on overlapping columns. The individual constraint takes precedence,
        // meaning no duplicate values are allowed for the individually constrained column,
        // even if the composite constraint would allow them.
        await db.schema.createTable('users')
            .addColumn({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true
            })
            .addColumn({
                name: 'username',
                type: 'TEXT',
                notNull: true
            })
            .addColumn({
                name: 'full_name',
                type: 'TEXT',
                notNull: true
            })
            .addColumn({
                name: 'next_composite',
                type: 'TEXT',
                notNull: true
            })
            .execute();

        // First: Create composite unique constraint
        await db.schema.alterTable('users')
            .makeColumnsUnique(['username', 'full_name', 'next_composite'])
            .execute();

        // Second: Create individual unique constraint on username
        await db.schema.alterTable('users')
            .makeColumnsUnique(['username'])
            .execute();

        const indexes = await db.schema.getIndexes('users');
        expect(indexes).toHaveLength(2);

        const individualIndex = indexes.find(idx =>
            idx.columns.length === 1 && idx.columns.includes('username')
        );
        const compositeIndex = indexes.find(idx =>
            idx.columns.length === 3 &&
            idx.columns.includes('username') &&
            idx.columns.includes('full_name') &&
            idx.columns.includes('next_composite')
        );

        expect(individualIndex).toBeDefined();
        expect(individualIndex!.unique).toBe(true);
        expect(compositeIndex).toBeDefined();
        expect(compositeIndex!.unique).toBe(true);

        // Insert first record
        await db.insert('users').values({
            id: 1,
            username: 'john',
            full_name: 'John Doe',
            next_composite: 'composite1'
        }).execute();

        // Test: Duplicate username (should fail due to individual unique constraint)
        try {
            await db.insert('users').values({
                id: 2,
                username: 'john', // Duplicate username
                full_name: 'Jane Smith',
                next_composite: 'composite2'
            }).execute();
            expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
            expect(error.message).toContain('UNIQUE constraint failed');
        }

        // Test: Different username, duplicate composite (should succeed because individual username constraint is stricter)
        // Note: When both individual and composite unique constraints exist on overlapping columns,
        // the individual constraint takes precedence, so this insertion should succeed
        await db.insert('users').values({
            id: 3,
            username: 'jane',
            full_name: 'John Doe', // Same full_name as first record
            next_composite: 'composite1' // Same next_composite as first record
        }).execute();
    });

    test("should support makeColumnsUnique with unique=false to create non-unique index", async () => {
        await db.schema.createTable('products')
            .addColumn({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true
            })
            .addColumn({
                name: 'category',
                type: 'TEXT',
                notNull: true
            })
            .addColumn({
                name: 'brand',
                type: 'TEXT',
                notNull: true
            })
            .execute();

        await db.schema.alterTable('products')
            .makeColumnsUnique(['category', 'brand'], false)
            .execute();

        const indexes = await db.schema.getIndexes('products');
        const index = indexes.find(idx =>
            idx.columns.includes('category') && idx.columns.includes('brand')
        );

        expect(index).toBeDefined();
        expect(index!.unique).toBe(false);
        expect(index!.columns).toEqual(['category', 'brand']);
    });

    test("should work in transactions", async () => {
        await db.transaction(async (tx) => {
            await tx.schema.createTable('users')
                .addColumn({
                    name: 'id',
                    type: 'INTEGER',
                    primaryKey: true
                })
                .addColumn({
                    name: 'email',
                    type: 'TEXT',
                    notNull: true
                })
                .execute();

            await tx.schema.alterTable('users')
                .makeColumnsUnique(['email'])
                .execute();

            const indexes = await tx.schema.getIndexes('users');
            const emailIndex = indexes.find(idx => idx.columns.includes('email'));

            expect(emailIndex).toBeDefined();
            expect(emailIndex!.unique).toBe(true);

            // Test data insertion
            await tx.insert('users').values({
                id: 1,
                email: 'john@example.com'
            }).execute();

            // Test unique constraint
            try {
                await tx.insert('users').values({
                    id: 2,
                    email: 'john@example.com' // Duplicate email
                }).execute();
                expect(true).toBe(false); // Should not reach here
            } catch (error: any) {
                expect(error.message).toContain('UNIQUE constraint failed');
            }
        });
    });

    test("should handle complex composite unique constraints", async () => {
        await db.schema.createTable('orders')
            .addColumn({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true
            })
            .addColumn({
                name: 'customer_id',
                type: 'INTEGER',
                notNull: true
            })
            .addColumn({
                name: 'product_id',
                type: 'INTEGER',
                notNull: true
            })
            .addColumn({
                name: 'order_date',
                type: 'TEXT',
                notNull: true
            })
            .execute();

        await db.schema.alterTable('orders')
            .makeColumnsUnique(['customer_id', 'product_id', 'order_date'])
            .execute();

        const indexes = await db.schema.getIndexes('orders');
        const compositeIndex = indexes.find(idx =>
            idx.columns.length === 3 &&
            idx.columns.includes('customer_id') &&
            idx.columns.includes('product_id') &&
            idx.columns.includes('order_date')
        );

        expect(compositeIndex).toBeDefined();
        expect(compositeIndex!.unique).toBe(true);

        // Insert first record
        await db.insert('orders').values({
            id: 1,
            customer_id: 1,
            product_id: 1,
            order_date: '2024-01-01'
        }).execute();

        // Test duplicate composite (should fail)
        try {
            await db.insert('orders').values({
                id: 2,
                customer_id: 1, // Same customer_id
                product_id: 1, // Same product_id
                order_date: '2024-01-01' // Same order_date
            }).execute();
            expect(true).toBe(false); // Should not reach here
        } catch (error: any) {
            expect(error.message).toContain('UNIQUE constraint failed');
        }

        // Test different composite (should succeed)
        await db.insert('orders').values({
            id: 3,
            customer_id: 1,
            product_id: 2, // Different product_id
            order_date: '2024-01-01'
        }).execute();
    });

    test("should preserve existing unique constraints when adding new ones", async () => {
        await db.schema.createTable('users')
            .addColumn({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true
            })
            .addColumn({
                name: 'email',
                type: 'TEXT',
                notNull: true,
                unique: true // Column-level unique constraint
            })
            .addColumn({
                name: 'username',
                type: 'TEXT',
                notNull: true
            })
            .execute();

        // Add composite unique constraint
        await db.schema.alterTable('users')
            .makeColumnsUnique(['username'])
            .execute();

        const indexes = await db.schema.getIndexes('users');
        expect(indexes.length).toBeGreaterThan(0);

        const tableInfo = await db.schema.getTableInfo('users');
        const emailColumn = tableInfo.find(col => col.name === 'email');
        const usernameColumn = tableInfo.find(col => col.name === 'username');

        // Email should still be unique (from column definition)
        expect(emailColumn!.unique).toBe(true);
        // Username should be unique (from makeColumnsUnique)
        expect(usernameColumn!.unique).toBe(true);
    });
});
