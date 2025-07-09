-- inout_games_setup.sql

-- Disable foreign key checks for easier table creation/alteration, re-enable at end
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Create inout_transactions table
-- Stores logs of all 'init', 'bet', 'withdraw', 'rollback' transactions
CREATE TABLE IF NOT EXISTS inout_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                          -- User ID from your system
    action VARCHAR(20) NOT NULL,                   -- 'init', 'bet', 'withdraw', 'rollback'
    amount DECIMAL(20, 4) NOT NULL,                -- Amount debited/credited
    result_amount DECIMAL(20, 4),                  -- For 'withdraw' actions (actual win amount)
    transaction_id VARCHAR(255) UNIQUE NOT NULL,   -- Unique ID from provider (for idempotency)
    debit_id VARCHAR(255),                         -- ID of the original bet transaction for withdraw/rollback
    game_id VARCHAR(255),                          -- Unique game session ID from provider
    currency VARCHAR(10),                          -- Currency of the transaction
    status VARCHAR(50) DEFAULT 'completed',        -- 'completed', 'failed', 'pending', etc.
    raw_response JSON,                             -- Stores full JSON response for idempotent re-sends
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_debit_id (debit_id)
);

-- 2. Create inout_sessions table (for tracking active game sessions if needed beyond auth token)
-- This is a suggested table based on Cursor's previous report. If your 'users' table token handling is sufficient,
-- you might not strictly need this depending on game session requirements.
CREATE TABLE IF NOT EXISTS inout_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,                          -- User ID from your system
    session_token VARCHAR(255) UNIQUE NOT NULL,    -- Session token from provider
    game_mode VARCHAR(50),
    operator_id VARCHAR(255),
    currency VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,                           -- Session expiration time
    INDEX idx_session_token (session_token),
    INDEX idx_user_id_session (user_id)
);

-- 3. Create inout_config table (for provider-specific settings)
-- This is a suggested table based on Cursor's previous report.
CREATE TABLE IF NOT EXISTS inout_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Create inout_audit_log table (for detailed logging of critical events)
-- This is a suggested table based on Cursor's previous report.
CREATE TABLE IF NOT EXISTS inout_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50) NOT NULL,               -- e.g., 'API_CALL', 'BALANCE_UPDATE', 'ERROR'
    user_id INT,
    transaction_id VARCHAR(255),
    details JSON,                                  -- Store structured log data (request, response, error)
    INDEX idx_event_type (event_type),
    INDEX idx_user_id_audit (user_id)
);

-- 5. Create inout_error_log table (for structured error logging)
-- This is a suggested table based on Cursor's previous report.
CREATE TABLE IF NOT EXISTS inout_error_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_code VARCHAR(50) NOT NULL,
    message TEXT,
    request_body JSON,                             -- Store the problematic request body
    stack_trace TEXT,
    INDEX idx_error_code (error_code)
);

-- 6. Create inout_game_stats table (for aggregating game statistics)
-- This is a suggested table based on Cursor's previous report.
CREATE TABLE IF NOT EXISTS inout_game_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_mode VARCHAR(50) UNIQUE NOT NULL,
    total_bets_count BIGINT DEFAULT 0,
    total_bets_amount DECIMAL(20, 4) DEFAULT 0.0000,
    total_wins_amount DECIMAL(20, 4) DEFAULT 0.0000,
    total_revenue DECIMAL(20, 4) DEFAULT 0.0000,    -- Total bets - Total wins
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. Create minutes_1 table (created during development for testing)
-- This table was created iteratively during development for testing purposes
CREATE TABLE IF NOT EXISTS minutes_1 (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bet DECIMAL(20, 4) DEFAULT 0.0000,             -- Added during development
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id_minutes (user_id)
);

-- 8. Create inout_test_data table (for storing test data during development)
-- This table was created during development for testing purposes
CREATE TABLE IF NOT EXISTS inout_test_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_name VARCHAR(255),
    test_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Create inout_debug_log table (for detailed debugging during development)
-- This table was created during development for debugging purposes
CREATE TABLE IF NOT EXISTS inout_debug_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    debug_level VARCHAR(20) DEFAULT 'INFO',        -- 'DEBUG', 'INFO', 'WARN', 'ERROR'
    message TEXT,
    context JSON,                                  -- Additional context data
    INDEX idx_debug_level (debug_level),
    INDEX idx_timestamp (timestamp)
);

-- 10. Create inout_performance_log table (for monitoring API performance)
-- This table was created during development for performance monitoring
CREATE TABLE IF NOT EXISTS inout_performance_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    response_time_ms INT,
    status_code INT,
    user_id INT,
    INDEX idx_endpoint (endpoint),
    INDEX idx_response_time (response_time_ms),
    INDEX idx_timestamp_perf (timestamp)
);

-- 11. Create inout_balance_history table (for tracking balance changes over time)
-- This table was created during development for balance tracking
CREATE TABLE IF NOT EXISTS inout_balance_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    previous_balance DECIMAL(20, 4),
    new_balance DECIMAL(20, 4),
    change_amount DECIMAL(20, 4),
    change_type VARCHAR(20),                       -- 'bet', 'win', 'refund', 'adjustment'
    transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id_balance (user_id),
    INDEX idx_transaction_id_balance (transaction_id),
    INDEX idx_created_at_balance (created_at)
);

-- 12. Create inout_api_requests table (for storing all API requests for debugging)
-- This table was created during development for API request tracking
CREATE TABLE IF NOT EXISTS inout_api_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    request_method VARCHAR(10),
    request_url TEXT,
    request_headers JSON,
    request_body JSON,
    response_status INT,
    response_body JSON,
    processing_time_ms INT,
    user_id INT,
    INDEX idx_timestamp_requests (timestamp),
    INDEX idx_user_id_requests (user_id),
    INDEX idx_response_status (response_status)
);

-- 13. Create inout_security_log table (for tracking security-related events)
-- This table was created during development for security monitoring
CREATE TABLE IF NOT EXISTS inout_security_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50),                        -- 'SIGNATURE_VALID', 'SIGNATURE_INVALID', 'MISSING_HEADER', 'INVALID_TOKEN'
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_data JSON,
    INDEX idx_event_type_security (event_type),
    INDEX idx_timestamp_security (timestamp),
    INDEX idx_ip_address (ip_address)
);

-- 14. Create inout_game_sessions table (for tracking individual game sessions)
-- This table was created during development for game session management
CREATE TABLE IF NOT EXISTS inout_game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    game_mode VARCHAR(50),
    game_id VARCHAR(255),
    operator_id VARCHAR(255),
    currency VARCHAR(10),
    initial_balance DECIMAL(20, 4),
    current_balance DECIMAL(20, 4),
    total_bet_amount DECIMAL(20, 4) DEFAULT 0.0000,
    total_win_amount DECIMAL(20, 4) DEFAULT 0.0000,
    status VARCHAR(20) DEFAULT 'active',           -- 'active', 'completed', 'cancelled'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_user_id_sessions (user_id),
    INDEX idx_game_id (game_id),
    INDEX idx_status (status)
);

-- 15. Create inout_provider_config table (for storing provider-specific configuration)
-- This table was created during development for configuration management
CREATE TABLE IF NOT EXISTS inout_provider_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 16. Alter existing users table to add In-Out Games specific balance and status
-- IMPORTANT: Adjust 'users' table name if it's different in your system.
-- Only add columns if they do not already exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS inout_balance DECIMAL(20, 4) DEFAULT 0.0000,
ADD COLUMN IF NOT EXISTS inout_status VARCHAR(50) DEFAULT 'active';

-- 17. Insert default configuration data
-- Only insert if not already exists
INSERT IGNORE INTO inout_provider_config (config_key, config_value, description) VALUES
('SECRET_KEY', '08C5AF03B9473F5F3200BB09011D78B864E6CC97DC3A1FD565B0D92802DD2E241402B29C146CC5B13EE3D962150E9CDA0260DA08CA0905E4E16542A847B6555B', 'In-Out Games API Secret Key'),
('OPERATOR_ID', 'a30c0bc1-d0bd-4257-b662-a840dff37321', 'In-Out Games Operator ID'),
('BASE_URL', 'https://api.inout.games', 'In-Out Games API Base URL'),
('DEFAULT_CURRENCY', 'INR', 'Default currency for transactions'),
('DEFAULT_GAME_MODE', 'plinko', 'Default game mode'),
('SUPPORTED_CURRENCIES', 'INR', 'Comma-separated list of supported currencies'),
('MIN_BET_AMOUNT', '0.01', 'Minimum bet amount'),
('MAX_BET_AMOUNT', '10000.00', 'Maximum bet amount'),
('SESSION_TIMEOUT_MINUTES', '30', 'Session timeout in minutes'),
('ENABLE_DEBUG_LOGGING', 'true', 'Enable detailed debug logging'),
('ENABLE_PERFORMANCE_MONITORING', 'true', 'Enable performance monitoring');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- 18. Create indexes for better performance (if they don't exist)
-- These indexes were added during development for performance optimization
CREATE INDEX IF NOT EXISTS idx_inout_transactions_created_at ON inout_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inout_transactions_action ON inout_transactions(action);
CREATE INDEX IF NOT EXISTS idx_inout_transactions_currency ON inout_transactions(currency);
CREATE INDEX IF NOT EXISTS idx_inout_transactions_user_action ON inout_transactions(user_id, action);
CREATE INDEX IF NOT EXISTS idx_inout_transactions_user_created ON inout_transactions(user_id, created_at);

-- 19. Add any missing columns to existing tables (safe operations)
-- These columns were added during development iterations
ALTER TABLE inout_transactions 
ADD COLUMN IF NOT EXISTS result_amount DECIMAL(20, 4) AFTER amount,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed' AFTER currency;

-- 20. Final verification query
-- This will show all created tables for verification
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME,
    UPDATE_TIME
FROM 
    information_schema.TABLES 
WHERE 
    TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME LIKE 'inout_%'
ORDER BY 
    TABLE_NAME; 