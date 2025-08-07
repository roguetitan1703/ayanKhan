import fs from 'fs';
import path from 'path';

// Function to view Spribe logs
function viewSpribeLogs() {
    const logFile = path.join('./logs', 'spribe.log');
    
    if (!fs.existsSync(logFile)) {
        console.log('❌ No Spribe log file found at:', logFile);
        console.log('Logs will be created when Spribe requests are processed.');
        return;
    }
    
    console.log('=== SPRIBE LOG FILE ===');
    console.log('File:', logFile);
    console.log('Size:', fs.statSync(logFile).size, 'bytes');
    console.log('Last modified:', fs.statSync(logFile).mtime);
    console.log('================================\n');
    
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    console.log(`📊 Total log entries: ${lines.length}\n`);
    
    // Show last 20 entries
    const recentLines = lines.slice(-20);
    console.log('📋 Recent log entries:');
    console.log('================================');
    
    recentLines.forEach((line, index) => {
        console.log(`${index + 1}. ${line}`);
    });
    
    // Summary by type
    const authCount = lines.filter(line => line.includes('AUTH')).length;
    const withdrawCount = lines.filter(line => line.includes('WITHDRAW')).length;
    const depositCount = lines.filter(line => line.includes('DEPOSIT')).length;
    const successCount = lines.filter(line => line.includes('SUCCESS')).length;
    const errorCount = lines.filter(line => line.includes('ERROR')).length;
    
    console.log('\n📈 Summary:');
    console.log('================================');
    console.log(`🔐 Auth requests: ${authCount}`);
    console.log(`💰 Withdraw requests: ${withdrawCount}`);
    console.log(`💸 Deposit requests: ${depositCount}`);
    console.log(`✅ Success responses: ${successCount}`);
    console.log(`❌ Error responses: ${errorCount}`);
    
    // Show unique transaction IDs
    const txIds = new Set();
    lines.forEach(line => {
        const match = line.match(/provider_tx_id['"]?\s*:\s*['"]?([^'",\s]+)['"]?/);
        if (match) {
            txIds.add(match[1]);
        }
    });
    
    console.log(`🆔 Unique transactions: ${txIds.size}`);
}

// Function to tail logs (real-time monitoring)
function tailSpribeLogs() {
    const logFile = path.join('./logs', 'spribe.log');
    
    console.log('🔄 Monitoring Spribe logs in real-time...');
    console.log('Press Ctrl+C to stop\n');
    
    if (!fs.existsSync(logFile)) {
        console.log('Waiting for log file to be created...');
    }
    
    // This is a simple implementation - in production you'd want a proper file watcher
    let lastSize = 0;
    
    setInterval(() => {
        if (fs.existsSync(logFile)) {
            const stats = fs.statSync(logFile);
            if (stats.size > lastSize) {
                const newContent = fs.readFileSync(logFile, 'utf8');
                const lines = newContent.split('\n');
                const newLines = lines.slice(lastSize === 0 ? 0 : Math.floor(lastSize / 100));
                
                newLines.forEach(line => {
                    if (line.trim()) {
                        console.log(`[${new Date().toLocaleTimeString()}] ${line}`);
                    }
                });
                
                lastSize = stats.size;
            }
        }
    }, 1000);
}

// Main function
function main() {
    const command = process.argv[2];
    
    if (command === 'tail' || command === 'monitor') {
        tailSpribeLogs();
    } else {
        viewSpribeLogs();
        console.log('\n💡 Usage:');
        console.log('  node view_spribe_logs.js          - View recent logs');
        console.log('  node view_spribe_logs.js tail     - Monitor logs in real-time');
    }
}

main(); 