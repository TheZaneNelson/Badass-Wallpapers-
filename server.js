require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');

// Debug environment variables
console.log("[CONFIG] Node Environment:", process.env.NODE_ENV);
console.log("[CONFIG] MongoDB URI:", process.env.MONGO_URI ? process.env.MONGO_URI.substring(0, 30) + '...' : 'Not found');

// Enhanced Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 50,
      minPoolSize: 10,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ MongoDB Atlas connection established');

    // Connection monitoring
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to DB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('Mongoose disconnected');
    });

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
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({
  origin: process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000'] 
    : ['https://your-production-domain.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// User Schema with indexes
const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'] },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    index: true,
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
      values: ['male', 'female', 'other', 'prefer-not-to-say'],
      message: '{VALUE} is not supported'
    }
  },
  createdAt: { type: Date, default: Date.now, index: true }
});

// Add indexes
userSchema.index({ name: 'text', email: 1 }); // Compound index
const User = mongoose.model('User', userSchema);

// API Routes
app.get('/', (req, res) => {
  res.json({
    status: 'API running',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// Healthcheck Endpoint
app.get('/api/healthcheck', async (req, res) => {
  try {
    // Test connection
    await mongoose.connection.db.admin().ping();
    
    // Test write operation
    const healthCheckCollection = mongoose.connection.db.collection('healthchecks');
    await healthCheckCollection.insertOne({
      timestamp: new Date(),
      status: 'healthy',
      server: os.hostname()
    });
    
    // Test read operation
    const lastCheck = await healthCheckCollection
      .find()
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    res.json({
      status: 'healthy',
      dbConnection: 'active',
      lastCheck: lastCheck[0]?.timestamp || 'No records found',
      checksInDB: await healthCheckCollection.countDocuments()
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// User Routes
app.post('/save-user', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    const errors = {};
    if (err.errors) {
      Object.keys(err.errors).forEach(key => {
        errors[key] = err.errors[key].message;
      });
    }
    
    res.status(400).json({
      success: false,
      error: err.message,
      errors,
      code: err.code // Useful for duplicate key errors
    });
  }
});

app.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query = search 
      ? { $text: { $search: search } } 
      : {};
    
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limit),
      data: users
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Scheduled Healthchecks
cron.schedule('*/30 * * * *', async () => { // Every 30 minutes
  try {
    const check = await mongoose.connection.db.admin().ping();
    console.log('🔄 Scheduled healthcheck:', check.ok === 1 ? 'OK' : 'WARNING');
  } catch (err) {
    console.error('❌ Scheduled healthcheck failed:', err.message);
    // Here you would add your alerting logic (email, Slack, etc.)
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

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });

  process.on('SIGINT', () => {
    server.close(() => {
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
})();

module.exports = app; // For testing