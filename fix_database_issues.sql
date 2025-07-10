-- Database Fix Script for phpMyAdmin
-- Run this script in phpMyAdmin SQL tab to fix common issues

-- =====================================================
-- STEP 1: Backup Current Structure (Optional)
-- =====================================================
-- Before running this script, export your database as backup

-- =====================================================
-- STEP 2: Fix Money Column Overflow Issue
-- =====================================================

-- Check current structure
DESCRIBE users;

-- Fix money column to handle large amounts
ALTER TABLE users MODIFY COLUMN money DECIMAL(20,4) DEFAULT 0.0000;

-- Fix total_money column if it exists
ALTER TABLE users MODIFY COLUMN total_money DECIMAL(20,4) DEFAULT 0.0000;

-- Verify the changes
DESCRIBE users;

-- =====================================================
-- STEP 3: Check for Problematic Data
-- =====================================================

-- Check for users with very large money values
SELECT id_user, phone, money, total_money 
FROM users 
WHERE money > 999999999 
LIMIT 10;

-- Check for any NULL money values and fix them
UPDATE users SET money = 0.0000 WHERE money IS NULL;

-- =====================================================
-- STEP 4: Add Missing Indexes for Better Performance
-- =====================================================

-- Add index on phone number for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Add index on user ID for faster joins
CREATE INDEX IF NOT EXISTS idx_users_id ON users(id_user);

-- Add index on money for balance queries
CREATE INDEX IF NOT EXISTS idx_users_money ON users(money);

-- =====================================================
-- STEP 5: Check Game Transactions Table (if exists)
-- =====================================================

-- Check if game_transactions table exists
SHOW TABLES LIKE 'game_transactions';

-- If game_transactions table exists, add indexes
-- CREATE INDEX IF NOT EXISTS idx_game_transactions_user_id ON game_transactions(user_id);
-- CREATE INDEX IF NOT EXISTS idx_game_transactions_created_at ON game_transactions(created_at);

-- =====================================================
-- STEP 6: Verify All Changes
-- =====================================================

-- Show all tables in the database
SHOW TABLES;

-- Show indexes on users table
SHOW INDEX FROM users;

-- Check database size
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables 
WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC;

-- =====================================================
-- STEP 7: Test Queries
-- =====================================================

-- Test a simple query to ensure everything works
SELECT COUNT(*) as total_users FROM users;

-- Test money column with large values
SELECT id_user, phone, money 
FROM users 
ORDER BY money DESC 
LIMIT 5;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- If you see this message, the script ran successfully!
-- Your database should now handle large money values without overflow errors.

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================
-- If you get errors:

-- 1. "Access denied" - Make sure you have ALTER privileges
-- 2. "Table doesn't exist" - Check table names are correct
-- 3. "Column doesn't exist" - Check column names are correct
-- 4. "Duplicate key" - Index already exists, that's OK

-- For any issues, contact your hosting provider or database administrator. 