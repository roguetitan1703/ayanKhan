-- fix_money_column.sql
-- Script to fix the money column data type issue in the users table

-- Check current column type
DESCRIBE users;

-- Alter the money column to DECIMAL(20,4) to handle large amounts with precision
-- This will prevent "Out of range value" errors
ALTER TABLE users MODIFY COLUMN money DECIMAL(20,4) DEFAULT 0.0000;

-- Also fix total_money column if it exists and has the same issue
ALTER TABLE users MODIFY COLUMN total_money DECIMAL(20,4) DEFAULT 0.0000;

-- Verify the changes
DESCRIBE users;

-- Optional: Check for any existing data that might be problematic
SELECT id_user, phone, money, total_money FROM users WHERE money > 999999999 LIMIT 10; 