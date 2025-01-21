import { createRouteHandlerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!exchangeError) {
      try {
        // Get the user's session to access their metadata
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          console.error('No user found in session after code exchange')
          return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
        }

        const { user } = session
        const metadata = user.user_metadata

        // Create record based on user type
        if (metadata.is_supporter) {
          const { error: supporterError } = await supabase
            .from('supporters')
            .insert([{
              id: user.id,
              email: user.email,
              full_name: metadata.full_name
            }])

          if (supporterError) {
            console.error('Error creating supporter record:', supporterError)
            return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
          }
        } else {
          const { error: userError } = await supabase
            .from('users')
            .insert([{
              id: user.id,
              email: user.email,
              full_name: metadata.full_name,
              company_id: metadata.company_id
            }])

          if (userError) {
            console.error('Error creating user record:', userError)
            return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
          }
        }

        // After successful record creation, redirect to root
        // The middleware will handle redirecting to the appropriate dashboard
        return NextResponse.redirect(requestUrl.origin)
      } catch (err) {
        console.error('Error in callback route:', err)
        return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
      }
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
} 