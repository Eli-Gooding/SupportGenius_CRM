import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('Session error:', sessionError)
      return NextResponse.json(
        { error: 'Session error' },
        { status: 401 }
      )
    }

    if (!session) {
      console.error('No session found')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Check if user is a supporter
    const { data: supporter, error: supporterError } = await supabase
      .from('supporters')
      .select('id')
      .eq('email', session.user.email)
      .maybeSingle()

    if (supporterError) {
      console.error('Supporter check error:', supporterError)
      return NextResponse.json(
        { error: 'Error checking user type' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      user: session.user,
      isSupporter: !!supporter,
      redirectTo: supporter ? '/supporter-dashboard' : '/customer-dashboard'
    })
  } catch (error) {
    console.error('Protected route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 