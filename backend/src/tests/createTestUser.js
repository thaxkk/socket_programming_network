import axios from 'axios';

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    const response = await axios.post('http://localhost:3000/api/auth/signup', {
      email: 'test@example.com',
      fullName: 'Test User',
      password: 'password123'
    }, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    console.log('✅ Test user created successfully!');
    console.log('Email: test@example.com');
    console.log('Password: password123');
    console.log('User ID:', response.data._id);
    console.log('\n📝 Save this User ID for testing group chats!');
    console.log('\nYou can now run: npm run test:socket');
    
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Test user already exists!');
      console.log('Email: test@example.com');
      console.log('Password: password123');
      console.log('\nYou can now run: npm run test:socket');
    } else {
      console.error('❌ Error creating user:', error.response?.data || error.message);
    }
  }
}

createTestUser();