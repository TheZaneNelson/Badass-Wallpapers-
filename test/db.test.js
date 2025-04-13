const mongoose = require('mongoose');
require('dotenv').config();

// Increase timeout
jest.setTimeout(30000); // 30 seconds

describe('Database Connection', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000 // 10 seconds
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('should connect successfully', () => {
    expect(mongoose.connection.readyState).toBe(1); // 1 = connected
  });

  test('should execute queries', async () => {
    const collections = await mongoose.connection.db.listCollections().toArray();
    expect(Array.isArray(collections)).toBeTruthy();
  });
});