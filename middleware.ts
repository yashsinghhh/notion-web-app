import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  '/'  // protect home page

//   '/profile/edit(.*)',  // protect profile edit page

]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    const isAuthorized = await auth.protect();
    return isAuthorized ? NextResponse.next() : null;
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};