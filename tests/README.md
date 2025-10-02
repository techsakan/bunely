# Bunely Test Suite

This directory contains comprehensive tests for the Bunely SQLite wrapper library. The test suite covers all major functionality including query builders, schema management, transactions, and error handling.

## Test Structure

```
tests/
├── setup.ts                    # Test utilities and database setup
├── database.test.ts            # Core Database class tests
├── transactions.test.ts        # Transaction functionality tests
├── transaction-methods.test.ts # Transaction method access tests
├── integration.test.ts         # End-to-end workflow tests
├── error-handling.test.ts      # Error handling and edge cases
├── query/                      # Query builder tests
│   ├── select.test.ts         # SELECT query builder tests
│   ├── insert.test.ts         # INSERT query builder tests
│   ├── update.test.ts         # UPDATE query builder tests
│   └── delete.test.ts         # DELETE query builder tests
└── schema/                     # Schema management tests
    └── schema.test.ts         # Schema builder tests
```

## Running Tests

### Run All Tests
```bash
bun test tests/
```

### Run Specific Test Categories
```bash
# Core database functionality
bun test tests/database.test.ts

# Query builders
bun test tests/query/

# Schema management
bun test tests/schema/

# Transactions
bun test tests/transactions.test.ts

# Integration tests
bun test tests/integration.test.ts

# Error handling
bun test tests/error-handling.test.ts
```

### Run with Coverage
```bash
bun test --coverage tests/
```

### Run in Watch Mode
```bash
bun test --watch tests/
```

## Test Categories

### 1. Core Database Tests (`database.test.ts`)
- Database creation (memory, file, from existing SQLite instance)
- Raw SQL execution (`run`, `get`, `all`)
- Convenience methods (`find`, `findOne`, `create`, `updateOne`, `deleteOne`)
- Foreign key management
- Error handling for invalid SQL

### 2. Query Builder Tests (`query/`)
- **SELECT**: Basic queries, joins, aggregations, ordering, pagination
- **INSERT**: Single/multiple inserts, returning clauses, constraints
- **UPDATE**: Single/multiple updates, conditions, returning clauses
- **DELETE**: Single/multiple deletes, conditions, returning clauses

### 3. Schema Management Tests (`schema/schema.test.ts`)
- Table creation with columns, foreign keys, indexes
- Table alteration (add/drop/rename columns)
- Index management (create/drop indexes)
- Schema introspection (table info, foreign keys, indexes)

### 4. Transaction Tests (`transactions.test.ts`)
- Simple and nested transactions
- Transaction rollback on errors
- Transaction retry logic
- Foreign key constraints in transactions
- Complex multi-operation transactions

### 5. Transaction Method Access Tests (`transaction-methods.test.ts`)
- Verifies that transaction objects have access to all database methods
- Tests raw SQL methods in transactions
- Tests convenience methods in transactions
- Tests schema methods in transactions
- Tests utility methods in transactions

### 6. Integration Tests (`integration.test.ts`)
- Complete blog workflow (users, posts, comments)
- User management workflow
- Complex query scenarios
- Schema evolution
- Performance scenarios

### 7. Error Handling Tests (`error-handling.test.ts`)
- SQL syntax errors
- Constraint violations (unique, not null, foreign key, check)
- Query builder errors
- Transaction errors
- Schema errors
- Data type errors
- Concurrency errors
- Edge cases (empty results, null values, special characters)

## Test Utilities

### Database Setup (`setup.ts`)
- `createTestDatabase()`: Creates an in-memory test database
- `setupTestDatabase()`: Creates database with sample schema and data
- `insertSampleData()`: Inserts test data for testing
- `cleanupTestDatabase()`: Safely closes database connections

### Test Data Types
- `TestUser`: User table structure
- `TestPost`: Post table structure  
- `TestComment`: Comment table structure

## Test Configuration

The tests use Bun's built-in test runner with the following configuration:

- **Timeout**: 30 seconds per test
- **Preload**: Test setup utilities are preloaded
- **Database**: In-memory SQLite databases for isolation
- **Cleanup**: Automatic database cleanup after each test

## Key Features Tested

### Query Builder API
- Fluent chaining syntax
- Type-safe operations
- SQL generation and parameter binding
- Complex joins and aggregations

### Schema Management
- Declarative table creation
- Schema introspection
- Index management
- Foreign key constraints

### Transaction Support
- Nested transactions with savepoints
- Automatic rollback on errors
- Retry logic for busy database errors
- Full method access within transactions

### Error Handling
- Comprehensive constraint validation
- Graceful error recovery
- Type-safe error handling
- Edge case coverage

### Performance
- Large dataset handling
- Complex query optimization
- Concurrent access patterns
- Memory usage validation

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Use the provided test utilities for database setup
3. Include both positive and negative test cases
4. Test edge cases and error conditions
5. Ensure proper cleanup after each test
6. Add appropriate type annotations

## Test Coverage

The test suite provides comprehensive coverage of:
- ✅ All public API methods
- ✅ All query builder functionality
- ✅ All schema management features
- ✅ All transaction scenarios
- ✅ All error conditions
- ✅ All edge cases
- ✅ Integration workflows
- ✅ Performance characteristics
