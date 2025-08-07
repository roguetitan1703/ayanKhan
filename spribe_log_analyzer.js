import fs from 'fs';

// Function to analyze Spribe logs
function analyzeSpribeLogs(logContent) {
    console.log('=== SPRIBE LOG ANALYSIS ===\n');
    
    const lines = logContent.split('\n');
    const spribeLogs = lines.filter(line => line.includes('[SPRIBE]'));
    
    // Group by transaction
    const transactions = {};
    let currentTx = null;
    
    spribeLogs.forEach(line => {
        // Extract transaction ID if present
        const txMatch = line.match(/provider_tx_id['"]?\s*:\s*['"]?([^'",\s]+)['"]?/);
        if (txMatch) {
            currentTx = txMatch[1];
            if (!transactions[currentTx]) {
                transactions[currentTx] = [];
            }
        }
        
        if (currentTx) {
            transactions[currentTx].push(line);
        }
    });
    
    // Analyze each transaction
    Object.keys(transactions).forEach(txId => {
        console.log(`\n--- Transaction: ${txId} ---`);
        const txLogs = transactions[txId];
        
        // Find withdraw and deposit for this transaction
        const withdraw = txLogs.find(log => log.includes('[WITHDRAW]') && log.includes('SUCCESS'));
        const deposit = txLogs.find(log => log.includes('[DEPOSIT]') && log.includes('SUCCESS'));
        
        if (withdraw) {
            console.log('✅ WITHDRAW (Bet placed)');
            const amountMatch = withdraw.match(/amount['"]?\s*:\s*(\d+)/);
            if (amountMatch) {
                console.log(`   Amount: ${amountMatch[1]} INR`);
            }
        }
        
        if (deposit) {
            console.log('✅ DEPOSIT (Winnings)');
            const amountMatch = deposit.match(/amount['"]?\s*:\s*(\d+)/);
            if (amountMatch) {
                console.log(`   Amount: ${amountMatch[1]} INR`);
            }
        }
        
        if (!withdraw && !deposit) {
            console.log('❌ Transaction incomplete or failed');
        }
    });
    
    // Summary statistics
    const totalTransactions = Object.keys(transactions).length;
    const successfulWithdraws = spribeLogs.filter(log => log.includes('[WITHDRAW][SUCCESS]')).length;
    const successfulDeposits = spribeLogs.filter(log => log.includes('[DEPOSIT][SUCCESS]')).length;
    const authRequests = spribeLogs.filter(log => log.includes('[AUTH][SUCCESS]')).length;
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total Transactions: ${totalTransactions}`);
    console.log(`Successful Withdraws (Bets): ${successfulWithdraws}`);
    console.log(`Successful Deposits (Winnings): ${successfulDeposits}`);
    console.log(`Auth Requests: ${authRequests}`);
    console.log(`Success Rate: ${((successfulWithdraws + successfulDeposits) / (totalTransactions * 2) * 100).toFixed(1)}%`);
}

// Function to monitor real-time logs
function monitorSpribeLogs() {
    console.log('=== REAL-TIME SPRIBE LOG MONITOR ===');
    console.log('Monitoring for Spribe activity...\n');
    
    // This would need to be integrated with your actual log monitoring system
    // For now, just show what to look for
    console.log('Look for these patterns in your logs:');
    console.log('✅ [SPRIBE][WITHDRAW][SUCCESS] - Bet placed successfully');
    console.log('✅ [SPRIBE][DEPOSIT][SUCCESS] - Winnings added successfully');
    console.log('❌ [SPRIBE][WITHDRAW][ERROR] - Bet failed');
    console.log('❌ [SPRIBE][DEPOSIT][ERROR] - Win processing failed');
    console.log('🔍 [SPRIBE][AUTH][SUCCESS] - User authenticated');
}

// Main function
function main() {
    console.log('SPRIBE LOG ANALYZER');
    console.log('===================\n');
    
    // Check if log file exists
    const logFile = process.argv[2];
    
    if (logFile && fs.existsSync(logFile)) {
        const logContent = fs.readFileSync(logFile, 'utf8');
        analyzeSpribeLogs(logContent);
    } else {
        monitorSpribeLogs();
        console.log('\nTo analyze existing logs:');
        console.log('node spribe_log_analyzer.js your_log_file.log');
    }
}

main(); 