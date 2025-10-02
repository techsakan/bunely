# Bunely Schema Management Guide

This guide explains how to work with database schemas using Bunely, including best practices and common patterns for SQLite.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Schema Utilities](#schema-utilities)
3. [Common Patterns](#common-patterns)
4. [Migration Management](#migration-management)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

## Quick Start

### Basic Setup

```typescript
import { Database } from "bun:sqlite";
import { Bunely } from "./index";

const db = new Database(":memory:");
const bunely = new Bunely(db);

// ⚠️ IMPORTANT: Always enable foreign keys
db.exec("PRAGMA foreign_keys = ON");
```

### Creating Tables

Since SQLite doesn't support CONSTRAINT syntax yet, use inline foreign key definitions:

```typescript
// ✅ Good - Inline foreign keys
db.exec(`
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
`);

// ❌ Not supported yet - Named constraints
db.exec(`
    CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id)
    )
`);
```

## Schema Utilities

Bunely includes comprehensive schema utilities for common operations:

```typescript
import { createSchemaUtils } from "./schema-utils";

const schemaUtils = createSchemaUtils(db);

// Check if table exists
if (schemaUtils.tableExists("users")) {
    console.log("Users table exists");
}

// Get table structure
const columns = schemaUtils.getTableInfo("users");
console.log("Columns:", columns.map(c => c.name));

// Create common table patterns
schemaUtils.createUserTable("users");
schemaUtils.createAuditTable("audit_log");

// Create indexes
schemaUtils.createCommonIndexes();

// Validate schema
const validation = schemaUtils.validateTableStructure("users", [
    "id", "username", "email", "created_at"
]);
```

## Common Patterns

### 1. User Table Pattern

```typescript
schemaUtils.createUserTable("users");
// Creates:
// - id (PRIMARY KEY)
// - username (UNIQUE)
// - email (UNIQUE)
// - password_hash
// - first_name, last_name
// - is_active (BOOLEAN)
// - created_at, updated_at (TIMESTAMPS)
```

### 2. Audit Log Pattern

```typescript
schemaUtils.createAuditTable("audit_log");
// Creates:
// - id (PRIMARY KEY)
// - table_name, record_id, action
// - old_values, new_values (JSON)
// - user_id, created_at
```

### 3. Soft Delete Pattern

```typescript
schemaUtils.createSoftDeleteTable("posts", `
    title TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'draft'
`);
// Creates:
// - id (PRIMARY KEY)
// - title, content, status (your columns)
// - deleted_at (for soft deletes)
// - created_at, updated_at (TIMESTAMPS)
```

### 4. Manual Table Creation

```typescript
// Create custom table
schemaUtils.createTable("custom_table", `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    value INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
`);

// Add column later
schemaUtils.addColumn("custom_table", "description", "TEXT");
```

## Migration Management

For production applications, use the migration system:

```typescript
import { createSchemaMigration } from "./schema-utils";

const migration = createSchemaMigration(db);

// Apply migrations
await migration.applyMigration(1, "Create users table", () => {
    db.exec(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL
        )
    `);
});

await migration.applyMigration(2, "Create posts table", () => {
    db.exec(`
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    `);
});

// Check current version
console.log("Current version:", migration.getCurrentVersion());
```

## Best Practices

### 1. Always Enable Foreign Keys

```typescript
// At the start of your application
db.exec("PRAGMA foreign_keys = ON");
```

### 2. Use Transactions for Data Consistency

```typescript
await bunely.transaction(async (tx) => {
    const user = tx.insert("users", { username: "john", email: "john@example.com" });
    tx.insert("posts", { user_id: user.lastInsertRowid, title: "My Post" });
});
```

### 3. Create Indexes for Performance

```typescript
// Common indexes
schemaUtils.createIndex("idx_users_email", "users", "email", true);
schemaUtils.createIndex("idx_posts_user_id", "posts", "user_id");
schemaUtils.createIndex("idx_posts_status", "posts", "status");
```

### 4. Use Meaningful Names

```typescript
// ✅ Good
CREATE TABLE user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bio TEXT,
    avatar_url TEXT
);

// ❌ Avoid
CREATE TABLE up (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid INTEGER NOT NULL,
    b TEXT
);
```

### 5. Add Timestamps to Most Tables

```typescript
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 6. Use Soft Deletes When Needed

```typescript
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    deleted_at DATETIME,  -- NULL means not deleted
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Query non-deleted posts
SELECT * FROM posts WHERE deleted_at IS NULL;
```

## Troubleshooting

### Foreign Key Constraint Errors

**Problem**: Foreign key constraints not working
```typescript
// ❌ Missing foreign key enablement
const db = new Database(":memory:");
// ... create tables with foreign keys
// Foreign keys won't work!

// ✅ Enable foreign keys
const db = new Database(":memory:");
db.exec("PRAGMA foreign_keys = ON");
// ... create tables with foreign keys
// Foreign keys will work!
```

### Index Creation Errors

**Problem**: Index creation fails
```typescript
// ❌ Creating index before table exists
schemaUtils.createIndex("idx_users_email", "users", "email");
// Error: no such table: users

// ✅ Create table first
schemaUtils.createUserTable("users");
schemaUtils.createIndex("idx_users_email", "users", "email");
```

### Schema Validation Failures

**Problem**: Schema validation fails
```typescript
const validation = schemaUtils.validateTableStructure("users", [
    "id", "username", "email"
]);

if (!validation.valid) {
    console.log("Missing columns:", validation.missing);
    console.log("Extra columns:", validation.extra);
}
```

### Column Name Issues

**Problem**: SQLite reserved words in column names
```typescript
// ❌ Using reserved words
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    table TEXT,  -- 'table' is a reserved word
    order INTEGER  -- 'order' is a reserved word
);

// ✅ Quote reserved words
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    "table" TEXT,
    "order" INTEGER
);
```

## Examples

Run the provided examples to see schema management in action:

```bash
# Basic schema operations
bun run examples/basic-schema.ts

# Schema utilities example
bun run examples/schema-example.ts

# Advanced migration example
bun run examples/schema-management.ts
```

## API Reference

### SchemaUtils

- `enableForeignKeys()` - Enable foreign key constraints
- `areForeignKeysEnabled()` - Check if foreign keys are enabled
- `getAllTables()` - Get all table names
- `tableExists(tableName)` - Check if table exists
- `getTableInfo(tableName)` - Get table structure
- `getTableIndexes(tableName)` - Get table indexes
- `getForeignKeys(tableName)` - Get foreign key info
- `createTable(name, columns)` - Create table
- `createIndex(name, table, columns)` - Create index
- `addColumn(table, column, definition)` - Add column
- `validateTableStructure(table, expectedColumns)` - Validate schema

### SchemaMigration

- `getCurrentVersion()` - Get current migration version
- `applyMigration(version, description, up)` - Apply migration
- `getAppliedMigrations()` - Get all applied migrations

## Conclusion

Bunely provides powerful schema management capabilities for SQLite databases. By following these patterns and best practices, you can create robust, maintainable database schemas that work well with SQLite's constraints and limitations.

Remember:
- Always enable foreign keys
- Use transactions for data consistency
- Create indexes for performance
- Validate schemas before operations
- Use meaningful names and patterns
- Consider soft deletes for data preservation
