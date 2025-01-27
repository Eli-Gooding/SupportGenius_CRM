//import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Temporarily bypass authentication for development
// TODO: Re-enable authentication checks before deployment
const publicRoutes = [
  '/login', 
  '/signup', 
  '/auth/callback', 
  '/api/auth/protected',
  '/supporter-dashboard',
  '/(customer)/customer-dashboard'
]

export async function middleware(req: NextRequest) {
  // During development, allow all routes
  return NextResponse.next()

  /* Authentication code preserved for later use
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  console.log('Session state:', session ? 'Active' : 'None')
  if (session?.user) {
    console.log('User:', session.user.email)
  }

  const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route))

  if (isPublicRoute) {
    return res
  }

  if (!session) {
    const redirectUrl = new URL('/login', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return res
  */
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/signup',
    '/(customer)/:path*',
    '/supporter-dashboard/:path*',
    '/api/auth/:path*',
  ],
} 