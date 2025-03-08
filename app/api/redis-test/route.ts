// app/api/redis-test/route.ts
import { NextResponse } from 'next/server';
import redisClient from '@/lib/redis';

export async function GET() {
  try {
    // Test setting a value
    await redisClient.set('test-key', 'Hello from Redis!');
    
    // Test getting the value
    const value = await redisClient.get('test-key');
    
    return NextResponse.json({ status: 'Connected', value });
  } catch (error) {
    console.error('Redis connection error:', error);
    return NextResponse.json({ 
      status: 'Error', 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}