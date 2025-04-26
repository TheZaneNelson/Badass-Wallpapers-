require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const xss = require('xss');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Initialize Express
const app = express();

// ======================
// SECURITY MIDDLEWARE
// ======================

// 1. Helmet for security headers
app.use(helmet());

// 2. Body parsers with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 3. Data Sanitization against XSS
app.use((req, res, next) => {
  if (req.body) {
    req.body = JSON.parse(xss(JSON.stringify(req.body)));
  }
  next();
});

// 4. Custom NoSQL injection sanitizer (replaces express-mongo-sanitize)
app.use((req, _, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(key => {
      if (key.includes('$')) {
        delete obj[key];
        console.log(`⚠️ Sanitized malicious key: ${key}`);
      }
      if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    });
  };
  
  sanitize(req.body);
  sanitize(req.query);
  next();
});

// 5. Prevent Parameter Pollution
app.use(hpp());

// 6. Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api', limiter);

// ======================
// APPLICATION MIDDLEWARE
// ======================

// CORS Configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'development' 
    ? ['http://localhost:3000'] 
    : ['https://astral-wallpapers.vercel.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Logging setup
if (process.env.NODE_ENV === 'production') {
  const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
  console.log('📝 Production logging enabled');
} else {
  app.use(morgan('dev'));
  console.log('🔍 Development logging enabled');
}

// Compression
app.use(compression());
console.log('🗜️ Response compression enabled');

// ======================
// DATABASE CONNECTION
// ======================
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
      console.log('🔄 Mongoose connected to DB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ Mongoose disconnected');
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

// ======================
// DATA MODELS
// ======================
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
userSchema.index({ name: 'text', email: 1 });
const User = mongoose.model('User', userSchema);
console.log('📊 User model and indexes initialized');

// ======================
// ROUTES
// ======================

// API Status Endpoint
app.get('/', (req, res) => {
  console.log('ℹ️ API status checked');
  res.json({
    status: 'API running',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    documentation: `${req.protocol}://${req.get('host')}/api-docs`
  });
});

// Healthcheck Endpoint
app.get('/api/healthcheck', async (req, res) => {
  console.log('🩺 Healthcheck initiated');
  try {
    // Test connection
    await mongoose.connection.db.admin().ping();
    
    // Test write operation
    const healthCheckCollection = mongoose.connection.db.collection('healthchecks');
    await healthCheckCollection.insertOne({
      timestamp: new Date(),
      status: 'healthy',
      server: process.env.HOSTNAME || 'render'
    });
    
    // Test read operation
    const lastCheck = await healthCheckCollection
      .find()
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    console.log('✅ Healthcheck completed successfully');
    res.json({
      status: 'healthy',
      dbConnection: 'active',
      lastCheck: lastCheck[0]?.timestamp || 'No records found',
      checksInDB: await healthCheckCollection.countDocuments(),
      memoryUsage: process.memoryUsage(),
      loadAvg: os.loadavg()
    });
  } catch (err) {
    console.error('❌ Healthcheck failed:', err.message);
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// User Routes
const validateUserInput = (req, res, next) => {
  console.log('🔍 Validating user input');
  const { name, email } = req.body;
  if (!name || !email) {
    console.log('❌ Validation failed: Name and email are required');
    return res.status(400).json({
      success: false,
      error: 'Name and email are required'
    });
  }
  next();
};

app.post('/api/save-user', validateUserInput, async (req, res) => {
  console.log('📥 Received request to save user');
  try {
    const user = new User(req.body);
    await user.save();
    console.log('✅ User saved successfully:', user.email);
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('❌ Error saving user:', err.message);
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
      code: err.code
    });
  }
});

app.get('/api/users', async (req, res) => {
  console.log('📥 Received request for users list');
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

    console.log(`📊 Returning ${users.length} users out of ${total}`);
    res.json({
      success: true,
      count: users.length,
      total,
      pages: Math.ceil(total / limit),
      data: users
    });
  } catch (err) {
    console.error('❌ Error fetching users:', err.message);
    res.status(500).json({
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ======================
// ERROR HANDLING
// ======================
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use((req, res) => {
  console.log('🔍 Requested endpoint not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: {
      root: '/',
      healthcheck: '/api/healthcheck',
      saveUser: 'POST /api/save-user',
      getUsers: 'GET /api/users'
    }
  });
});

// ======================
// SCHEDULED TASKS
// ======================
cron.schedule('*/30 * * * *', async () => {
  console.log('⏰ Running scheduled healthcheck...');
  try {
    const check = await mongoose.connection.db.admin().ping();
    console.log('🔄 Scheduled healthcheck:', check.ok === 1 ? 'OK' : 'WARNING');
    
    console.log('📈 System Stats:', {
      memory: process.memoryUsage(),
      load: os.loadavg(),
      uptime: os.uptime()
    });
  } catch (err) {
    console.error('❌ Scheduled healthcheck failed:', err.message);
  }
});
console.log('⏰ Scheduled tasks initialized');

// ======================
// SERVER INITIALIZATION
// ======================
(async () => {
  await connectDB();
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${port}`);
    console.log(`🔗 Base URL: http://localhost:${port}`);
    console.log(`📝 API Docs: http://localhost:${port}/api-docs`);
    console.log('🛡️ Security Headers: Enabled');
    console.log('📊 Rate Limiting: Enabled (100 requests/15min)');
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('🛑 Shutting down gracefully...');
    server.close(async () => {
      await mongoose.connection.close(false);
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();

module.exports = app;