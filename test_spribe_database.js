import connection from "./src/config/connectDB.js";

async function testSpribeDatabase() {
    try {
        console.log('=== TESTING SPRIBE DATABASE CONNECTION ===');
        
        // Test the connection
        const [testResult] = await connection.query('SELECT 1 as test');
        console.log('Database connection test:', testResult);
        
        // Check if spribeLaunchToken column exists
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'spribeLaunchToken'
        `);
        console.log('spribeLaunchToken column exists:', columns.length > 0);
        
        // Check total users
        const [totalUsers] = await connection.query('SELECT COUNT(*) as total FROM users');
        console.log('Total users in database:', totalUsers[0].total);
        
        // Check users with spribeLaunchToken
        const [usersWithToken] = await connection.query('SELECT COUNT(*) as total FROM users WHERE spribeLaunchToken IS NOT NULL');
        console.log('Users with spribeLaunchToken:', usersWithToken[0].total);
        
        // Check for the specific token from the logs
        const testToken = '6e49a01a26e1ee74d21425db4be6c8a6a790785931f073895b74f67ac1c1edba';
        const [specificUser] = await connection.query('SELECT * FROM users WHERE spribeLaunchToken = ?', [testToken]);
        console.log('User with specific token found:', specificUser.length > 0);
        
        if (specificUser.length > 0) {
            console.log('User details:', {
                id: specificUser[0].id_user,
                name: specificUser[0].name_user,
                money: specificUser[0].money,
                token: specificUser[0].spribeLaunchToken
            });
        } else {
            console.log('Token not found in database');
            
            // Show some sample users with spribeLaunchToken
            const [sampleUsers] = await connection.query('SELECT id_user, name_user, spribeLaunchToken FROM users WHERE spribeLaunchToken IS NOT NULL LIMIT 5');
            console.log('Sample users with spribeLaunchToken:', sampleUsers);
        }
        
    } catch (error) {
        console.error('Database test error:', error);
    } finally {
        process.exit(0);
    }
}

testSpribeDatabase(); 