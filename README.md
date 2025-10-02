# Bunely

A modern SQLite wrapper for Bun with query builder, schema management, and transaction support.

## Features

- 🚀 **Fluent Query Builder** - Chainable API for SELECT, INSERT, UPDATE, DELETE
- 🏗️ **Schema Management** - Create, modify, and introspect database schemas
- 🔄 **Transaction Support** - Nested transactions with savepoints and retry logic
- 🛡️ **Type Safety** - Full TypeScript support with comprehensive type definitions
- ⚡ **Performance** - Built on Bun's native SQLite bindings
- 🔧 **SQLite Compatible** - Works with all SQLite features and constraints

## Quick Start

```typescript
import { createMemoryDatabase } from "bunely";

// Create a database
const db = createMemoryDatabase();

// Enable foreign keys
db.enableForeignKeys();

// Create tables using schema builder
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
    .execute();

// Insert data using query builder
const user = await db.insert("users")
    .values({
        username: "alice",
        email: "alice@example.com"
    })
    .execute();

// Query data
const users = await db.select()
    .from("users")
    .where({ username: "alice" })
    .execute();

// Use transactions
await db.transaction(async (tx) => {
    await tx.insert("users").values({ username: "bob", email: "bob@example.com" }).execute();
    await tx.insert("users").values({ username: "charlie", email: "charlie@example.com" }).execute();
});
```

## Installation

```bash
bun add bunely
```

## API Reference

### Database Creation

```typescript
import { createMemoryDatabase, createFileDatabase, createDatabase } from "bunely";
import { Database as SQLiteDatabase } from "bun:sqlite";

// In-memory database
const db = createMemoryDatabase();

// File-based database
const db = createFileDatabase("database.sqlite");

// From existing SQLite database
const sqliteDb = new SQLiteDatabase("database.sqlite");
const db = createDatabase(sqliteDb);
```

### Query Builder

#### SELECT Queries

```typescript
// Simple select
const users = await db.select()
    .from("users")
    .execute();

// Select with conditions (object syntax)
const alice = await db.select()
    .from("users")
    .where({ username: "alice" })
    .first();

// Select with explicit where conditions
const aliceExplicit = await db.select()
    .from("users")
    .where("username", "=", "alice")
    .first();

// Select with joins
const postsWithUsers = await db.select([
    "p.title",
    "u.username"
])
    .from("posts as p")
    .join("users as u", "p.user_id = u.id")
    .execute();

// Complex queries
const recentPosts = await db.select()
    .from("posts")
    .where({ status: "published" })
    .orderBy(["created_at DESC"])
    .limit(10)
    .execute();

// Explicit where conditions with operators
const adults = await db.select()
    .from("users")
    .where("age", ">", 18)
    .where("is_active", "=", true)
    .execute();

// LIKE operators
const aliceUsers = await db.select()
    .from("users")
    .where("username", "LIKE", "alice%")
    .execute();

// IN operators
const specificUsers = await db.select()
    .from("users")
    .where("id", "IN", [1, 2, 3])
    .execute();

// BETWEEN operators
const middleAged = await db.select()
    .from("users")
    .where("age", "BETWEEN", 25, 65)
    .execute();

// NULL operators
const usersWithEmail = await db.select()
    .from("users")
    .where("email", "IS NOT NULL")
    .execute();
```

#### Supported Where Operators

Bunely supports the following operators for explicit where conditions:

**Comparison Operators:**
- `=` - Equal to
- `!=` or `<>` - Not equal to
- `<` - Less than
- `>` - Greater than
- `<=` - Less than or equal to
- `>=` - Greater than or equal to

**Pattern Matching:**
- `LIKE` - Pattern matching (use `%` for wildcards)
- `NOT LIKE` - Negated pattern matching

**Set Operations:**
- `IN` - Value is in a list
- `NOT IN` - Value is not in a list

**Range Operations:**
- `BETWEEN` - Value is between two values (inclusive)
- `NOT BETWEEN` - Value is not between two values

**Null Operations:**
- `IS NULL` - Value is null
- `IS NOT NULL` - Value is not null

**Examples:**
```typescript
// Comparison
.where("age", ">", 18)
.where("price", "<=", 100)

// Pattern matching
.where("name", "LIKE", "John%")
.where("email", "NOT LIKE", "%@spam.com")

// Set operations
.where("status", "IN", ["active", "pending"])
.where("category", "NOT IN", ["deleted", "archived"])

// Range operations
.where("age", "BETWEEN", 18, 65)
.where("price", "NOT BETWEEN", 10, 50)

// Null operations
.where("description", "IS NULL")
.where("email", "IS NOT NULL")
```

#### INSERT Queries

```typescript
// Single insert
const result = await db.insert("users")
    .values({
        username: "alice",
        email: "alice@example.com"
    })
    .execute();

// Multiple inserts
const results = await db.insert("users")
    .values([
        { username: "bob", email: "bob@example.com" },
        { username: "charlie", email: "charlie@example.com" }
    ])
    .execute();

// Insert with returning
const user = await db.insert("users")
    .values({ username: "david", email: "david@example.com" })
    .returning(["id", "username"])
    .execute();
```

#### UPDATE Queries

```typescript
// Update with conditions (object syntax)
const result = await db.update("users")
    .set({ age: 30 })
    .where({ username: "alice" })
    .execute();

// Update with explicit where conditions
const resultExplicit = await db.update("users")
    .set({ age: 30 })
    .where("username", "=", "alice")
    .execute();

// Update multiple records
const result = await db.update("posts")
    .set({ status: "published" })
    .where("status", "=", "draft")
    .execute();

// Update with comparison operators
const adultUsers = await db.update("users")
    .set({ verified: true })
    .where("age", ">=", 18)
    .execute();
```

#### DELETE Queries

```typescript
// Delete with conditions (object syntax)
const result = await db.delete("users")
    .where({ username: "alice" })
    .execute();

// Delete with explicit where conditions
const resultExplicit = await db.delete("users")
    .where("username", "=", "alice")
    .execute();

// Delete with comparison operators
const oldPosts = await db.delete("posts")
    .where("created_at", "<", "2023-01-01")
    .execute();

// Delete with returning
const deleted = await db.delete("posts")
    .where("status", "=", "draft")
    .returning(["id", "title"])
    .execute();
```

### Schema Management

#### Creating Tables

```typescript
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
        name: "created_at",
        type: "DATETIME",
        defaultValue: "CURRENT_TIMESTAMP"
    })
    .addForeignKey({
        column: "profile_id",
        references: {
            table: "profiles",
            column: "id"
        },
        onDelete: "CASCADE"
    })
    .execute();
```

#### Creating Indexes

```typescript
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
```

#### Schema Introspection

```typescript
// Check if table exists
const hasTable = await db.schema.hasTable("users");

// Get table structure
const columns = await db.schema.getTableInfo("users");

// Get foreign keys
const foreignKeys = await db.schema.getForeignKeys("posts");

// Get indexes
const indexes = await db.schema.getIndexes("users");
```

### Transactions

```typescript
// Simple transaction
await db.transaction(async (tx) => {
    await tx.insert("users").values({ username: "alice" }).execute();
    await tx.insert("posts").values({ user_id: 1, title: "My Post" }).execute();
});

// Transaction with options
await db.transaction(async (tx) => {
    // Your operations here
}, {
    tries: 3,
    backoffMs: 100
});

// Nested transactions
await db.transaction(async (tx) => {
    await tx.insert("users").values({ username: "alice" }).execute();
    
    await tx.transaction(async (innerTx) => {
        await innerTx.insert("posts").values({ user_id: 1, title: "Nested Post" }).execute();
    });
});
```

### Convenience Methods

```typescript
// Find records
const users = await db.find("users", { status: "active" });
const user = await db.findOne("users", { username: "alice" });

// Create record
const result = await db.create("users", { username: "alice", email: "alice@example.com" });

// Update record
const result = await db.updateOne("users", { age: 30 }, { username: "alice" });

// Delete record
const result = await db.deleteOne("users", { username: "alice" });
```

### Raw SQL

```typescript
// Execute raw SQL
const result = await db.run("INSERT INTO users (username) VALUES (?)", ["alice"]);
const users = await db.all("SELECT * FROM users WHERE age > ?", [25]);
const user = await db.get("SELECT * FROM users WHERE id = ?", [1]);
```

## Type Definitions

Bunely provides comprehensive TypeScript types for all operations:

```typescript
import type { 
    ColumnDefinition, 
    ForeignKeyDefinition, 
    IndexDefinition,
    WhereClause,
    TransactionOptions 
} from "bunely";

const column: ColumnDefinition = {
    name: "id",
    type: "INTEGER",
    primaryKey: true,
    autoIncrement: true
};
```

## Examples

Check out the `examples/` directory for comprehensive examples:

- `query-builder.ts` - Complete query builder example
- `basic-schema.ts` - Basic schema operations
- `schema-example.ts` - Schema utilities example
- `schema-management.ts` - Advanced migration management

## Architecture

The library is organized into several modules:

- `src/core/` - Core database class and mutex
- `src/query/` - Query builders (SELECT, INSERT, UPDATE, DELETE)
- `src/schema/` - Schema builders (CREATE TABLE, ALTER TABLE, etc.)
- `src/types/` - TypeScript type definitions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT