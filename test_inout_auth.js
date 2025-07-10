// Test script to verify In-Out Games authentication
// Run this with: node test_inout_auth.js

import axios from 'axios';
import connection from './src/config/connectDB.js';

async function testInOutAuthentication() {
    try {
        console.log('🔍 Testing In-Out Games Authentication...\n');

        // Step 1: Get a real user from the database
        console.log('1. Fetching a real user from database...');
        const [users] = await connection.query(
            "SELECT `id_user`, `phone`, `money`, `token` FROM users LIMIT 1"
        );

        if (!users || users.length === 0) {
            console.error('❌ No users found in database!');
            return;
        }

        const user = users[0];
        console.log(`✅ Found user: ID=${user.id_user}, Phone=${user.phone}, Balance=${user.money}`);
        console.log(`   Token: ${user.token.substring(0, 20)}...`);

        // Step 2: Test the launch URL generation with real token
        console.log('\n2. Testing launch URL generation...');
        
        // Simulate a request with the user's auth cookie
        const response = await axios.get('http://localhost:3000/inout/launch?gameMode=plinko', {
            headers: {
                'Cookie': `auth=${user.token}`
            }
        });

        if (response.data.success) {
            console.log('✅ Launch URL generated successfully!');
            console.log(`   User ID: ${response.data.user.id}`);
            console.log(`   User Phone: ${response.data.user.phone}`);
            console.log(`   User Balance: ${response.data.user.balance}`);
            console.log(`   Game URL: ${response.data.url.substring(0, 100)}...`);
            
            // Check if the authToken in the URL matches the user's token
            const urlParams = new URLSearchParams(response.data.url.split('?')[1]);
            const authTokenInUrl = urlParams.get('authToken');
            
            if (authTokenInUrl === user.token) {
                console.log('✅ Auth token in URL matches user token!');
            } else {
                console.log('❌ Auth token mismatch!');
                console.log(`   Expected: ${user.token.substring(0, 20)}...`);
                console.log(`   Got: ${authTokenInUrl.substring(0, 20)}...`);
            }
        } else {
            console.log('❌ Failed to generate launch URL');
            console.log(`   Error: ${response.data.message}`);
        }

        // Step 3: Test with invalid token
        console.log('\n3. Testing with invalid token...');
        try {
            await axios.get('http://localhost:3000/inout/launch?gameMode=plinko', {
                headers: {
                    'Cookie': 'auth=invalid_token_here'
                }
            });
            console.log('❌ Should have failed with invalid token!');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Correctly rejected invalid token');
            } else {
                console.log('❌ Unexpected error with invalid token:', error.message);
            }
        }

        // Step 4: Test without token
        console.log('\n4. Testing without auth token...');
        try {
            await axios.get('http://localhost:3000/inout/launch?gameMode=plinko');
            console.log('❌ Should have failed without token!');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Correctly rejected request without token');
            } else {
                console.log('❌ Unexpected error without token:', error.message);
            }
        }

        console.log('\n🎉 Authentication test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Response status:', error.response.status);
            console.error('   Response data:', error.response.data);
        }
    } finally {
        // Close database connection
        await connection.end();
    }
}

// Run the test
testInOutAuthentication(); 