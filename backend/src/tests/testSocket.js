import { io } from "socket.io-client";
import axios from "axios";

async function testSocketWithAuth() {
  try {
    console.log('Attempting to login...');
    
    // First, login to get the cookie
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    }, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    console.log('Login successful!');
    console.log('Response data:', loginResponse.data);
    
    const currentUserId = loginResponse.data._id;
    console.log('Current User ID:', currentUserId);

    // Extract cookie from response
    const cookies = loginResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';

    console.log('Cookie:', cookieString);

    // Get all users to find valid user IDs for the group
    console.log('\nFetching all users...');
    const usersResponse = await axios.get('http://localhost:3000/api/messages/contacts', {
      withCredentials: true,
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });

    console.log('Available users:', usersResponse.data);
    
    // Get user IDs (limit to first 2 users if available)
    const otherUsers = usersResponse.data.slice(0, 2).map(user => user._id);
    console.log('Selected users for group:', otherUsers);

    // Connect to Socket.IO with cookie
    const socket = io("http://localhost:3000", {
      withCredentials: true,
      extraHeaders: {
        cookie: cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    socket.on("connect", () => {
      console.log("\n✅ Connected to Socket.IO server");

      // Test creating a group chat with real user IDs
      console.log('Creating group chat...');
      socket.emit("createGroupChat", {
        groupName: "Test Group Chat",
        members: otherUsers // Use real user IDs
      });
    });

    socket.on("groupChatCreatedSuccess", (data) => {
      console.log("\n✅ Group chat created successfully!");
      console.log('Group ID:', data._id);
      console.log('Group Name:', data.name);
      console.log('Members:', data.members);
      
      // Test sending a group message
      console.log('\nTesting group message...');
      socket.emit("sendGroupMessage", {
        groupId: data._id,
        text: "Hello, this is a test group message!",
        image: ""
      });
    });

    socket.on("newGroupMessage", (message) => {
      console.log("\n✅ Group message sent successfully!");
      console.log('Message:', message);
      
      console.log('\n✅ All tests passed!');
      socket.disconnect();
    });

    socket.on("groupChatError", (error) => {
      console.error("\n❌ Group chat error:", error);
      socket.disconnect();
    });

    socket.on("groupMessageError", (error) => {
      console.error("\n❌ Group message error:", error);
      socket.disconnect();
    });

    socket.on("connect_error", (error) => {
      console.error("\n❌ Connection error:", error.message);
      process.exit(1);
    });

    socket.on("disconnect", () => {
      console.log("\nDisconnected from server");
      process.exit(0);
    });

  } catch (error) {
    console.error('\n❌ Authentication error:', error.response?.data || error.message);
    process.exit(1);
  }
}

console.log('========================================');
console.log('Starting Socket.IO Group Chat Test...');
console.log('========================================');
console.log('Make sure your server is running on http://localhost:3000\n');
testSocketWithAuth();