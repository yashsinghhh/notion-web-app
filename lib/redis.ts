import { Redis } from 'ioredis';

// This will use the REDIS_URL environment variable
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export default redisClient;