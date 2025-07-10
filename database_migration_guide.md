# Database Migration Guide - phpMyAdmin

## Accessing phpMyAdmin

1. **Login to your hosting control panel** (cPanel, Plesk, etc.)
2. **Find phpMyAdmin** in the database section
3. **Click on phpMyAdmin** to open it
4. **Select your database** from the left sidebar

## Fixing Money Column Overflow Issue

### Step 1: Check Current Column Structure
```sql
-- Run this query to see current column types
DESCRIBE users;
```

### Step 2: Fix Money Column Data Type
```sql
-- Alter the money column to handle large amounts
ALTER TABLE users MODIFY COLUMN money DECIMAL(20,4) DEFAULT 0.0000;

-- Also fix total_money if it exists
ALTER TABLE users MODIFY COLUMN total_money DECIMAL(20,4) DEFAULT 0.0000;
```

### Step 3: Verify Changes
```sql
-- Check the updated structure
DESCRIBE users;

-- Check for any problematic data
SELECT id_user, phone, money, total_money 
FROM users 
WHERE money > 999999999 
LIMIT 10;
```

## Common Database Operations

### 1. Adding New Columns
```sql
-- Add a new column
ALTER TABLE table_name ADD COLUMN column_name VARCHAR(255) DEFAULT NULL;

-- Example: Add game provider column
ALTER TABLE game_transactions ADD COLUMN provider VARCHAR(50) DEFAULT 'unknown';
```

### 2. Updating Data
```sql
-- Update specific records
UPDATE users SET money = 1000000 WHERE id_user = 1;

-- Update multiple records
UPDATE users SET status = 'active' WHERE status = 'pending';
```

### 3. Creating New Tables
```sql
-- Create a new table
CREATE TABLE game_providers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    api_url VARCHAR(255),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Adding Indexes
```sql
-- Add index for better performance
CREATE INDEX idx_user_phone ON users(phone);
CREATE INDEX idx_transaction_date ON game_transactions(created_at);
```

### 5. Backup Before Changes
```sql
-- Export table structure and data
-- Use phpMyAdmin Export feature:
-- 1. Select your database
-- 2. Click "Export" tab
-- 3. Choose "Custom" export method
-- 4. Select tables to backup
-- 5. Choose "SQL" format
-- 6. Click "Go" to download backup
```

## Troubleshooting Common Issues

### 1. "Out of range value" Error
**Problem**: Column can't handle the data size
**Solution**: Increase column size or change data type
```sql
-- For INT columns
ALTER TABLE table_name MODIFY COLUMN column_name BIGINT;

-- For VARCHAR columns
ALTER TABLE table_name MODIFY COLUMN column_name VARCHAR(500);
```

### 2. "Duplicate entry" Error
**Problem**: Unique constraint violation
**Solution**: Check for duplicates and handle them
```sql
-- Find duplicates
SELECT column_name, COUNT(*) 
FROM table_name 
GROUP BY column_name 
HAVING COUNT(*) > 1;

-- Remove duplicates (be careful!)
DELETE t1 FROM table_name t1
INNER JOIN table_name t2 
WHERE t1.id > t2.id 
AND t1.column_name = t2.column_name;
```

### 3. "Cannot add foreign key constraint" Error
**Problem**: Referenced table/column doesn't exist or types don't match
**Solution**: Ensure referenced table exists and column types match
```sql
-- Check if referenced table exists
SHOW TABLES LIKE 'referenced_table_name';

-- Check column types
DESCRIBE referenced_table_name;
```

## Security Best Practices

### 1. Always Backup Before Changes
- Export your database before making structural changes
- Test changes on a copy first if possible

### 2. Use Transactions for Multiple Changes
```sql
START TRANSACTION;
-- Your changes here
ALTER TABLE users MODIFY COLUMN money DECIMAL(20,4);
UPDATE users SET money = money * 1000 WHERE money < 1000;
COMMIT;
-- If something goes wrong, use ROLLBACK instead of COMMIT
```

### 3. Limit Access
- Use specific database users with limited permissions
- Don't use root user for application connections

## Monitoring Database Health

### 1. Check Table Sizes
```sql
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = 'your_database_name'
ORDER BY (data_length + index_length) DESC;
```

### 2. Check for Slow Queries
```sql
-- Enable slow query log in MySQL configuration
-- Check for queries taking longer than 2 seconds
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
```

### 3. Monitor Connection Count
```sql
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';
```

## Emergency Recovery

### 1. If Changes Break Something
```sql
-- Rollback changes using backup
-- Or restore from backup file

-- If you have a backup SQL file:
-- 1. Drop the problematic table
DROP TABLE table_name;

-- 2. Import from backup
-- Use phpMyAdmin Import feature to restore
```

### 2. Reset Auto Increment
```sql
-- If auto increment gets out of sync
ALTER TABLE table_name AUTO_INCREMENT = 1;
```

## Contact Information

If you encounter issues:
1. **Check error logs** in your hosting control panel
2. **Contact your hosting provider** for database issues
3. **Keep backups** of all changes
4. **Test changes** in a development environment first

---

**Important**: Always backup your database before making any structural changes! 