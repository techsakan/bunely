# Bunely Examples

This directory contains practical examples demonstrating how to use the Bunely SQLite wrapper library.

## Examples

### 1. Simple Usage (`simple-usage.ts`)
A comprehensive example showing all the basic features of Bunely:
- Database creation and setup
- Schema management
- Data insertion, querying, updating, and deletion
- Both object-style and explicit where conditions
- Transactions
- Convenience methods
- Raw SQL execution
- Schema introspection

**Run it:**
```bash
bun run examples/simple-usage.ts
```

### 2. Explicit Where Examples (`explicit-where-examples.ts`)
Focused examples demonstrating the explicit where syntax with operators:
- Basic comparison operators (`=`, `!=`, `<`, `>`, `<=`, `>=`)
- Pattern matching (`LIKE`, `NOT LIKE`)
- Set operations (`IN`, `NOT IN`)
- Range operations (`BETWEEN`, `NOT BETWEEN`)
- Null operations (`IS NULL`, `IS NOT NULL`)
- Complex queries with multiple conditions
- SQL generation
- Transactions with explicit where conditions

**Run it:**
```bash
bun run examples/explicit-where-examples.ts
```

### 3. Basic Schema (`basic-schema.ts`)
Examples of schema management operations:
- Creating tables with various column types
- Adding foreign keys and constraints
- Creating indexes
- Schema introspection
- Data manipulation with schema awareness

### 4. Query Builder (`query-builder.ts`)
Comprehensive query builder examples:
- All query types (SELECT, INSERT, UPDATE, DELETE)
- Complex joins and aggregations
- Advanced query patterns
- Performance considerations

### 5. Schema Management (`schema-management.ts`)
Advanced schema management examples:
- Migration patterns
- Schema versioning
- Complex table relationships
- Index optimization

## Key Features Demonstrated

### Explicit Where Conditions
The new explicit where syntax provides more control and clarity:

```typescript
// Object style (still supported)
.where({ username: "alice" })

// Explicit style (new)
.where("username", "=", "alice")
.where("age", ">", 18)
.where("name", "LIKE", "John%")
.where("status", "IN", ["active", "pending"])
.where("price", "BETWEEN", 10, 100)
.where("description", "IS NULL")
```

### Transaction Support
Full transaction support with all database methods:

```typescript
await db.transaction(async (tx) => {
    // All methods available in transactions
    const user = await tx.create("users", { name: "Alice" });
    await tx.update("posts").set({ user_id: user.lastInsertRowid }).where("id", "=", 1).execute();
    await tx.delete("comments").where("post_id", "=", 1).execute();
});
```

### Schema Management
Declarative schema creation and management:

```typescript
await db.schema.createTable("users")
    .addColumn({ name: "id", type: "INTEGER", primaryKey: true, autoIncrement: true })
    .addColumn({ name: "username", type: "TEXT", notNull: true, unique: true })
    .addForeignKey({ column: "profile_id", references: { table: "profiles", column: "id" } })
    .execute();
```

## Running Examples

All examples are designed to be run with Bun:

```bash
# Run a specific example
bun run examples/simple-usage.ts

# Run all examples
bun run examples/*.ts
```

## Prerequisites

- Bun runtime installed
- TypeScript support (included with Bun)

## Notes

- All examples use in-memory databases for demonstration
- Examples include proper cleanup and error handling
- Each example is self-contained and can be run independently
- Examples demonstrate both basic and advanced usage patterns
