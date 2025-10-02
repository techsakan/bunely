/**
 * Explicit Where Conditions Examples
 * 
 * This file demonstrates the explicit where syntax with operators
 */

import { createMemoryDatabase } from "../src/index";

console.log("=== Explicit Where Conditions Examples ===\n");

// Create database and setup
const db = createMemoryDatabase();
db.enableForeignKeys();

// Create a simple table
await db.schema.createTable("products")
    .addColumn({
        name: "id",
        type: "INTEGER",
        primaryKey: true,
        autoIncrement: true
    })
    .addColumn({
        name: "name",
        type: "TEXT",
        notNull: true
    })
    .addColumn({
        name: "price",
        type: "REAL",
        notNull: true
    })
    .addColumn({
        name: "category",
        type: "TEXT"
    })
    .addColumn({
        name: "in_stock",
        type: "BOOLEAN",
        defaultValue: true
    })
    .addColumn({
        name: "created_at",
        type: "DATETIME",
        defaultValue: "CURRENT_TIMESTAMP"
    })
    .execute();

// Insert sample data
await db.insert("products").values([
    { name: "Laptop", price: 999.99, category: "Electronics", in_stock: true },
    { name: "Mouse", price: 29.99, category: "Electronics", in_stock: true },
    { name: "Keyboard", price: 79.99, category: "Electronics", in_stock: false },
    { name: "Desk", price: 299.99, category: "Furniture", in_stock: true },
    { name: "Chair", price: 199.99, category: "Furniture", in_stock: true },
    { name: "Monitor", price: 399.99, category: "Electronics", in_stock: true },
    { name: "Headphones", price: 149.99, category: "Electronics", in_stock: false }
]).execute();

console.log("✅ Sample data inserted\n");

// 1. Basic comparison operators
console.log("1. Basic comparison operators...");

// Equals
const laptops = await db.select()
    .from("products")
    .where("name", "=", "Laptop")
    .execute();
console.log("Laptops:", laptops);

// Not equals
const notLaptops = await db.select()
    .from("products")
    .where("name", "!=", "Laptop")
    .execute();
console.log("Not laptops:", notLaptops.length, "items");

// Greater than
const expensiveItems = await db.select()
    .from("products")
    .where("price", ">", 200)
    .execute();
console.log("Expensive items (>$200):", expensiveItems.map(p => p.name));

// Less than or equal
const affordableItems = await db.select()
    .from("products")
    .where("price", "<=", 100)
    .execute();
console.log("Affordable items (<=$100):", affordableItems.map(p => p.name));

console.log("✅ Basic operators demonstrated\n");

// 2. LIKE operators
console.log("2. LIKE operators...");

// Starts with
const electronics = await db.select()
    .from("products")
    .where("category", "LIKE", "Electronics%")
    .execute();
console.log("Electronics:", electronics.map(p => p.name));

// Contains
const itemsWithE = await db.select()
    .from("products")
    .where("name", "LIKE", "%e%")
    .execute();
console.log("Items with 'e' in name:", itemsWithE.map(p => p.name));

// NOT LIKE
const nonElectronics = await db.select()
    .from("products")
    .where("category", "NOT LIKE", "Electronics%")
    .execute();
console.log("Non-electronics:", nonElectronics.map(p => p.name));

console.log("✅ LIKE operators demonstrated\n");

// 3. IN operators
console.log("3. IN operators...");

// IN
const specificItems = await db.select()
    .from("products")
    .where("name", "IN", ["Laptop", "Mouse", "Desk"])
    .execute();
console.log("Specific items:", specificItems.map(p => p.name));

// NOT IN
const otherItems = await db.select()
    .from("products")
    .where("name", "NOT IN", ["Laptop", "Mouse", "Desk"])
    .execute();
console.log("Other items:", otherItems.map(p => p.name));

console.log("✅ IN operators demonstrated\n");

// 4. BETWEEN operators
console.log("4. BETWEEN operators...");

// BETWEEN
const midRangeItems = await db.select()
    .from("products")
    .where("price", "BETWEEN", 50, 200)
    .execute();
console.log("Mid-range items ($50-$200):", midRangeItems.map(p => `${p.name} ($${p.price})`));

// NOT BETWEEN
const extremeItems = await db.select()
    .from("products")
    .where("price", "NOT BETWEEN", 50, 200)
    .execute();
console.log("Extreme price items:", extremeItems.map(p => `${p.name} ($${p.price})`));

console.log("✅ BETWEEN operators demonstrated\n");

// 5. NULL operators
console.log("5. NULL operators...");

// Insert an item with null category
await db.insert("products")
    .values({
        name: "Mystery Item",
        price: 99.99,
        category: null,
        in_stock: true
    })
    .execute();

// IS NULL
const nullCategoryItems = await db.select()
    .from("products")
    .where("category", "IS NULL")
    .execute();
console.log("Items with null category:", nullCategoryItems.map(p => p.name));

// IS NOT NULL
const categorizedItems = await db.select()
    .from("products")
    .where("category", "IS NOT NULL")
    .execute();
console.log("Categorized items:", categorizedItems.length, "items");

console.log("✅ NULL operators demonstrated\n");

// 6. Multiple conditions
console.log("6. Multiple conditions...");

const expensiveElectronics = await db.select()
    .from("products")
    .where("category", "=", "Electronics")
    .where("price", ">", 100)
    .where("in_stock", "=", true)
    .execute();
console.log("Expensive electronics in stock:", expensiveElectronics.map(p => p.name));

console.log("✅ Multiple conditions demonstrated\n");

// 7. UPDATE with explicit where
console.log("7. UPDATE with explicit where...");

// Update prices
const priceUpdateResult = await db.update("products")
    .set({ price: 1099.99 })
    .where("name", "=", "Laptop")
    .execute();
console.log(`Updated ${priceUpdateResult.changes} laptop price`);

// Update stock status
const stockUpdateResult = await db.update("products")
    .set({ in_stock: true })
    .where("in_stock", "=", false)
    .execute();
console.log(`Updated ${stockUpdateResult.changes} items to in stock`);

console.log("✅ UPDATE with explicit where demonstrated\n");

// 8. DELETE with explicit where
console.log("8. DELETE with explicit where...");

// Delete out of stock items
const deleteResult = await db.delete("products")
    .where("in_stock", "=", false)
    .execute();
console.log(`Deleted ${deleteResult.changes} out of stock items`);

// Delete expensive items
const expensiveDeleteResult = await db.delete("products")
    .where("price", ">", 500)
    .execute();
console.log(`Deleted ${expensiveDeleteResult.changes} expensive items`);

console.log("✅ DELETE with explicit where demonstrated\n");

// 9. Complex queries
console.log("9. Complex queries...");

const categoryStats = await db.select([
    "category",
    "COUNT(*) as item_count",
    "AVG(price) as avg_price",
    "MIN(price) as min_price",
    "MAX(price) as max_price"
])
    .from("products")
    .where("category", "IS NOT NULL")
    .groupBy(["category"])
    .orderBy(["avg_price DESC"])
    .execute();
console.log("Category statistics:", categoryStats);

console.log("✅ Complex queries demonstrated\n");

// 10. SQL generation
console.log("10. SQL generation...");

const query = db.select()
    .from("products")
    .where("price", ">", 100)
    .where("category", "=", "Electronics")
    .where("in_stock", "=", true);

const { sql, params } = query.toSQL();
console.log("Generated SQL:", sql);
console.log("Parameters:", params);

console.log("✅ SQL generation demonstrated\n");

// 11. Transactions with explicit where
console.log("11. Transactions with explicit where...");

await db.transaction(async (tx) => {
    // Create a new product
    const newProduct = await tx.insert("products")
        .values({
            name: "Tablet",
            price: 599.99,
            category: "Electronics",
            in_stock: true
        })
        .execute();

    // Update all electronics to be in stock
    const updateResult = await tx.update("products")
        .set({ in_stock: true })
        .where("category", "=", "Electronics")
        .execute();

    // Delete items under $50
    const deleteResult = await tx.delete("products")
        .where("price", "<", 50)
        .execute();

    console.log(`Transaction: Created 1 product, updated ${updateResult.changes} items, deleted ${deleteResult.changes} items`);
});

console.log("✅ Transactions with explicit where demonstrated\n");

// 12. Final results
console.log("12. Final results...");

const allProducts = await db.select()
    .from("products")
    .orderBy(["price DESC"])
    .execute();
console.log("All remaining products:");
allProducts.forEach(product => {
    console.log(`  - ${product.name}: $${product.price} (${product.category || 'No category'})`);
});

console.log("✅ Final results displayed\n");

// Cleanup
db.close();
console.log("✅ Database closed");

console.log("\n=== Explicit Where Conditions Examples Complete ===");
