require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// Debug environment variables
console.log("[CONFIG] Node Environment:", process.env.NODE_ENV);
console.log("[CONFIG] MongoDB URI:", process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 30) + '...' : 'Not found');

// Database Connection with enhanced error handling
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000
    });
    console.log('✅ MongoDB Atlas connection established');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('Full error:', err);
    console.log('\n=== TROUBLESHOOTING CHECKLIST ===');
    console.log('1. Verify .env file exists in project root');
    console.log('2. Check MongoDB Atlas IP whitelist (0.0.0.0/0 temporarily)');
    console.log('3. Confirm database user privileges');
    console.log('4. Ensure network isn\'t blocking port 27017');
    process.exit(1);
  }
};

// Initialize Express
const app = express();
app.use(bodyParser.json());
app.use(cors({
  origin: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : 'https://your-production-domain.com'
}));

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'] },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    validate: {
      validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: props => `${props.value} is not a valid email!`
    }
  },
  age: { 
    type: Number, 
    min: [8, 'Age must be at least 8'],
    max: [120, 'Age must be less than 120'] 
  },
  gender: { 
    type: String, 
    enum: {
      values: ['male', 'female', 'other'],
      message: '{VALUE} is not supported'
    }
  },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// API Routes
app.get('/', (req, res) => {
  res.json({
    status: 'API running',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

app.post('/save-user', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message,
      fields: err.errors ? Object.keys(err.errors) : []
    });
  }
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Start Server
(async () => {
  await connectDB();
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${port}`);
    console.log(`🔗 Base URL: http://localhost:${port}`);
    console.log(`📝 API Docs: http://localhost:${port}/api-docs`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Process terminated');
    });
  });
})();