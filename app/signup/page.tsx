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

export default function Signup() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [isSupporter, setIsSupporter] = useState(false)
  const [companyId, setCompanyId] = useState("")
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Fetch companies on component mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        console.log('Fetching companies...')
        const { data, error } = await supabase
          .from('companies')
          .select('id, company_name')
          .order('company_name')

        console.log('Raw response:', { data, error })

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

        // Map the data to match our expected format
        const formattedCompanies = data.map(company => ({
          id: company.id,
          name: company.company_name
        }))

        console.log('Formatted companies:', formattedCompanies)
        setCompanies(formattedCompanies)
      } catch (err) {
        console.error('Unexpected error fetching companies:', err)
        setError('An unexpected error occurred. Please try again later.')
      }
    }

    fetchCompanies()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Sign up the user
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            is_supporter: isSupporter,
            company_id: !isSupporter ? companyId : null,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      // Redirect to confirmation pending page
      router.push("/auth/confirmation-pending")
    } catch (err) {
      console.error("Signup error:", err)
      setError("An unexpected error occurred during signup")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create your account</h2>
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
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <Label htmlFor="email-address">Email address</Label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
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
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="full-name">Full Name</Label>
              <Input
                id="full-name"
                name="full_name"
                type="text"
                autoComplete="name"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
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
            {!isSupporter && (
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
          </div>

          <div>
            <Button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

