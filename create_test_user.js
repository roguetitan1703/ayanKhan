import connection from "./src/config/connectDB.js";

async function createTestUser() {
    try {
        console.log('=== CREATING TEST USER FOR SPRIBE ===');
        
        const testToken = '6e49a01a26e1ee74d21425db4be6c8a6a790785931f073895b74f67ac1c1edba';
        const testUser = {
            name_user: 'Test Spribe User',
            phone: '1234567890',
            money: 1000.00, // 1000 INR
            spribeLaunchToken: testToken
        };
        
        // Check if user already exists
        const [existingUser] = await connection.query('SELECT * FROM users WHERE spribeLaunchToken = ?', [testToken]);
        
        if (existingUser.length > 0) {
            console.log('Test user already exists:', {
                id: existingUser[0].id_user,
                name: existingUser[0].name_user,
                money: existingUser[0].money
            });
        } else {
            // Create new test user
            const [result] = await connection.query(`
                INSERT INTO users (name_user, phone, money, spribeLaunchToken, status, veri) 
                VALUES (?, ?, ?, ?, 1, 1)
            `, [testUser.name_user, testUser.phone, testUser.money, testUser.spribeLaunchToken]);
            
            console.log('Test user created successfully:', {
                id: result.insertId,
                name: testUser.name_user,
                money: testUser.money,
                token: testUser.spribeLaunchToken
            });
        }
        
        // Verify the user exists
        const [verifyUser] = await connection.query('SELECT * FROM users WHERE spribeLaunchToken = ?', [testToken]);
        console.log('Verification - User found:', verifyUser.length > 0);
        
    } catch (error) {
        console.error('Error creating test user:', error);
    } finally {
        process.exit(0);
    }
}

createTestUser(); 