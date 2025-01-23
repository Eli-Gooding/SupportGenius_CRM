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

        // First check if user exists in supporters table
        const { data: existingSupporter } = await supabase
          .from('supporters')
          .select('id')
          .eq('id', user.id)
          .single()

        if (existingSupporter) {
          // Update last_login for supporter
          await supabase
            .from('supporters')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id)
          
          return NextResponse.redirect(`${requestUrl.origin}/supporter-dashboard`)
        }

        // Then check if user exists in users (customers) table
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        if (existingUser) {
          // Update last_login for user
          await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id)
          
          return NextResponse.redirect(`${requestUrl.origin}/customer-dashboard`)
        }

        // If user doesn't exist in either table, create new record based on metadata
        const metadata = user.user_metadata

        if (metadata.is_supporter) {
          const { error: supporterError } = await supabase
            .from('supporters')
            .insert([{
              id: user.id,
              email: user.email,
              full_name: metadata.full_name,
              last_login: new Date().toISOString()
            }])

          if (supporterError) {
            console.error('Error creating supporter record:', supporterError)
            return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
          }

          return NextResponse.redirect(`${requestUrl.origin}/supporter-dashboard`)
        } else {
          const { error: userError } = await supabase
            .from('users')
            .insert([{
              id: user.id,
              email: user.email,
              full_name: metadata.full_name,
              company_id: metadata.company_id,
              last_login: new Date().toISOString()
            }])

          if (userError) {
            console.error('Error creating user record:', userError)
            return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
          }

          return NextResponse.redirect(`${requestUrl.origin}/customer-dashboard`)
        }
      } catch (err) {
        console.error('Error in callback route:', err)
        return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
      }
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error`)
} 