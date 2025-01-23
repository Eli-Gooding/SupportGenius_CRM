"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { createRouteHandlerClient } from "@/lib/supabase/server"
import { Separator } from "@/components/ui/separator"
import { Github, Mail } from "lucide-react"

export default function Signup() {
  // Authentication state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isOAuthFlow, setIsOAuthFlow] = useState(false)
  const [oAuthEmail, setOAuthEmail] = useState("")
  
  // Profile state
  const [fullName, setFullName] = useState("")
  const [isSupporter, setIsSupporter] = useState(false)
  const [companyId, setCompanyId] = useState("")
  const [supporterPassword, setSupporterPassword] = useState("")
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([])
  
  // UI state
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'auth' | 'profile'>('auth')
  
  const router = useRouter()
  const supabase = createClient()

  // Check if we're in OAuth flow on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        // Only set OAuth flow if we have a session AND we're on the signup page with signup=true query param
        const searchParams = new URLSearchParams(window.location.search)
        const isSignupFlow = searchParams.get('signup') === 'true'
        
        if (session?.user && isSignupFlow) {
          console.log('OAuth signup flow detected:', {
            email: session.user.email,
            isSignupFlow,
            user: session.user
          })
          setIsOAuthFlow(true)
          setOAuthEmail(session.user.email || "")
          setEmail(session.user.email || "")
          setStep('profile')
        } else {
          console.log('No OAuth session or not signup flow:', {
            hasSession: !!session,
            isSignupFlow
          })
          setIsOAuthFlow(false)
          setOAuthEmail("")
          setStep('auth')
        }
      } catch (error) {
        console.error('Error checking session:', error)
        setError('Failed to check authentication status')
        setStep('auth')
      }
    }
    
    checkSession()
  }, [])

  // Fetch companies when entering profile step
  useEffect(() => {
    if (step === 'profile' && !isSupporter) {
      const fetchCompanies = async () => {
        try {
          // Use anon key for public access to companies
          const { data, error } = await supabase
            .from('companies')
            .select('id, company_name')
            .order('company_name')
            .returns<{ id: string; company_name: string }[]>()

          if (error) {
            console.error('Error fetching companies:', error)
            setError('Failed to load companies. Please try again later.')
            return
          }

          if (!data || data.length === 0) {
            console.warn('No companies found in the database')
            setError('No companies available. Please contact support.')
            return
          }

          const formattedCompanies = data.map(company => ({
            id: company.id,
            name: company.company_name
          }))

          console.log('Fetched companies:', formattedCompanies)
          setCompanies(formattedCompanies)
          setError('') // Clear any previous errors if successful
        } catch (err) {
          console.error('Unexpected error fetching companies:', err)
          setError('An unexpected error occurred. Please try again later.')
        }
      }

      fetchCompanies()
    }
  }, [step, isSupporter, supabase])

  const handleOAuthSignUp = async (provider: 'github' | 'google') => {
    try {
      setError("")
      setIsLoading(true)
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/signup?signup=true`,
          queryParams: {
            signup: 'true'
          }
        }
      })

      if (error) throw error

      // The OAuth flow will redirect to the provider's login page
      // When it returns, our useEffect will handle the profile step
    } catch (error) {
      console.error('OAuth error:', error)
      setError(error instanceof Error ? error.message : 'An error occurred during OAuth sign up')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) throw signUpError
      setStep('profile')
    } catch (err) {
      console.error("Email signup error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred during signup")
    } finally {
      setIsLoading(false)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (isSupporter && supporterPassword !== process.env.NEXT_PUBLIC_SUPPORTER_PASSWORD) {
        throw new Error('Invalid supporter password')
      }

      // Get the current session to get the user ID
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        throw new Error('No authenticated user found')
      }

      if (isOAuthFlow) {
        // Update OAuth user metadata
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            is_supporter: isSupporter,
            company_id: !isSupporter ? companyId : null,
          }
        })

        if (updateError) throw updateError

        // Create record in appropriate table
        if (isSupporter) {
          const { error: supporterError } = await supabase
            .from('supporters')
            .insert([{
              id: session.user.id,  // Include the auth user ID
              email: oAuthEmail,
              full_name: fullName,
            }])
          if (supporterError) throw supporterError
        } else {
          const { error: userError } = await supabase
            .from('users')
            .insert([{
              id: session.user.id,  // Include the auth user ID
              email: oAuthEmail,
              full_name: fullName,
              company_id: companyId,
            }])
          if (userError) throw userError
        }

        router.replace(isSupporter ? '/supporter-dashboard' : '/customer-dashboard')
      } else {
        // Update email signup user metadata
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            is_supporter: isSupporter,
            company_id: !isSupporter ? companyId : null,
          }
        })

        if (updateError) throw updateError

        router.push("/auth/confirmation-pending")
      }
    } catch (err) {
      console.error("Profile submission error:", err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 'auth' ? "Create your account" : "Complete your profile"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              sign in to your existing account
            </Link>
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'auth' && !isOAuthFlow && (
          <>
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthSignUp('github')}
              >
                <Github className="mr-2 h-4 w-4" />
                Sign up with GitHub
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => handleOAuthSignUp('google')}
              >
                <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                  <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                </svg>
                Sign up with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-50 px-2 text-gray-500">Or continue with email</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleEmailSignUp} className="space-y-6">
              <div>
                <Label htmlFor="email-address">Email address</Label>
                <Input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                <Mail className="mr-2 h-4 w-4" />
                {isLoading ? "Creating account..." : "Continue"}
              </Button>
            </form>
          </>
        )}

        {step === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div>
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="user-type">Account Type</Label>
              <Select
                value={isSupporter ? "supporter" : "customer"}
                onValueChange={(value) => setIsSupporter(value === "supporter")}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="supporter">Support Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isSupporter ? (
              <div>
                <Label htmlFor="supporter-password">Supporter Password</Label>
                <Input
                  id="supporter-password"
                  name="supporter_password"
                  type="password"
                  required
                  value={supporterPassword}
                  onChange={(e) => setSupporterPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="company">Company</Label>
                <Select
                  value={companyId}
                  onValueChange={setCompanyId}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading 
                ? "Creating account..." 
                : "Complete Registration"
              }
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

