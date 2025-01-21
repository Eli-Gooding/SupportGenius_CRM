import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// List of public routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup',
  '/auth/confirmation-pending',
  '/auth/auth-code-error',
]

// List of auth-specific routes that should be accessible while handling auth
const authRoutes = [
  '/auth/callback',
]

/**
 * Updates the user session in middleware
 * IMPORTANT: This function must be called before any other middleware logic
 * to ensure proper session management
 */
export async function updateSession(request: NextRequest) {
  try {
    console.log('Middleware - Processing request for:', request.nextUrl.pathname)
    
    // Create a response and a supabase client
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req: request, res })

    // Refresh session if it exists
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    console.log('Middleware - Session state:', session ? 'Exists' : 'None', 'User:', session?.user?.email)
    
    if (sessionError) {
      console.error('Middleware - Session error:', sessionError)
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Handle public routes
    const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))
    const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route))

    console.log('Middleware - Route type:', {
      isPublicRoute,
      isAuthRoute,
      path: request.nextUrl.pathname
    })

    // Allow access to auth-specific routes
    if (isAuthRoute) {
      console.log('Middleware - Allowing auth route access')
      return res
    }

    // If user is not logged in
    if (!session) {
      // Allow access to public routes
      if (isPublicRoute) {
        console.log('Middleware - Allowing public route access (no session)')
        return res
      }
      // Redirect to login for protected routes
      console.log('Middleware - Redirecting to login (no session)')
      const response = NextResponse.redirect(new URL('/login', request.url))
      
      // Copy cookies to maintain state
      const cookies = res.headers.getSetCookie()
      cookies.forEach(cookie => {
        response.headers.append('Set-Cookie', cookie)
      })
      
      return response
    }

    // If user is logged in but trying to access public routes or root
    if (session && (isPublicRoute || request.nextUrl.pathname === '/')) {
      try {
        console.log('Middleware - Checking user type for redirect')
        
        // Check user type and redirect to appropriate dashboard
        const { data: supporter, error: supporterError } = await supabase
          .from('supporters')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle()

        if (supporterError) {
          console.error('Middleware - Error checking supporter status:', supporterError)
          throw supporterError
        }

        const redirectPath = supporter ? '/supporter-dashboard' : '/customer-dashboard'
        console.log('Middleware - Redirecting to:', redirectPath)
        
        const redirectUrl = new URL(redirectPath, request.url)
        const response = NextResponse.redirect(redirectUrl)
        
        // Copy cookies to maintain session
        const cookies = res.headers.getSetCookie()
        cookies.forEach(cookie => {
          response.headers.append('Set-Cookie', cookie)
        })
        
        return response
      } catch (err) {
        console.error('Middleware - Error in redirect:', err)
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }

    // For all other cases, allow the request to proceed
    console.log('Middleware - Allowing request to proceed')
    return res
  } catch (e) {
    // If there's an error, redirect to login
    console.error('Middleware - Unexpected error:', e)
    return NextResponse.redirect(new URL('/login', request.url))
  }
} 