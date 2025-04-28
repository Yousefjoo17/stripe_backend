// dummy-data/users.js
const bcrypt = require('bcryptjs');

// Pre-hashed passwords for demo purposes
// In a real application, you'd hash them properly
const dummyUsers = [
  {
    id: 1,
    username: "joo",
    email: "john@example.com",
    password: "123", // password123
    createdAt: "2025-01-15T10:30:00.000Z"
  },
  {
    id: 2,
    username: "janedoe",
    email: "jane@example.com",
    password: "$2a$10$Ht1vsSKHH9M3mZVRStu3huV9fzEr0xJwyS0R0eBIk9UvIRQXJRXFS", // securepwd456
    createdAt: "2025-02-20T14:15:00.000Z"
  },
  {
    id: 3,
    username: "bobsmith",
    email: "bob@example.com",
    password: "$2a$10$QHCisIq152.Wl16Zia2Y.OFw53hGJQTMl6hUkO3YZxnJPZfpJZGQm", // bobpass789
    createdAt: "2025-03-01T09:45:00.000Z"
  }
];

module.exports = dummyUsers;