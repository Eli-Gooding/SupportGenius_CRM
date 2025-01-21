"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCompanies } from "@/hooks/use-companies"

export default function Signup() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompany, setSelectedCompany] = useState<string>("")
  const [companyPassword, setCompanyPassword] = useState("")
  const [showCompanyPassword, setShowCompanyPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isEmailSent, setIsEmailSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { companies, isLoading: isLoadingCompanies, error: companiesError } = useCompanies(searchTerm)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Validate company selection
      if (!selectedCompany) {
        setError("Please select a company")
        setIsLoading(false)
        return
      }

      // Validate Gauntlet AI password if selected
      if (showCompanyPassword && companyPassword !== "password") {
        setError("Invalid company password")
        setIsLoading(false)
        return
      }

      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
            is_supporter: showCompanyPassword && companyPassword === "password"
          }
        }
      })

      if (authError) {
        setError(authError.message)
        return
      }

      if (authData?.user) {
        // Get company ID
        const selectedCompanyData = companies.find(c => c.company_name === selectedCompany)
        
        if (showCompanyPassword && companyPassword === "password") {
          // Create supporter record
          const { error: supporterError } = await supabase
            .from('supporters')
            .insert([
              {
                id: authData.user.id,
                email: email,
                full_name: fullName
              }
            ])

          if (supporterError) {
            setError("Error creating supporter account")
            return
          }
        } else {
          // Create user record
          const { error: userError } = await supabase
            .from('users')
            .insert([
              {
                id: authData.user.id,
                email: email,
                full_name: fullName,
                company_id: selectedCompanyData?.id
              }
            ])

          if (userError) {
            setError("Error creating user account")
            return
          }
        }

        setIsEmailSent(true)
      }
    } catch (err) {
      setError("An error occurred during signup")
    } finally {
      setIsLoading(false)
    }
  }

  // Update showCompanyPassword when company selection changes
  const handleCompanySelect = (companyName: string) => {
    console.log('handleCompanySelect called with:', companyName)
    setSelectedCompany(companyName)
    setShowCompanyPassword(companyName === "Gauntlet AI")
    setOpen(false)
    setSearchTerm("")
  }

  if (isEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Check your email</h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              We've sent you a confirmation email. Please click the link in the email to verify your account.
            </p>
            <p className="mt-4 text-center text-sm text-gray-500">
              Didn't receive the email? Check your spam folder or{" "}
              <button 
                onClick={handleSubmit} 
                className="font-medium text-blue-600 hover:text-blue-500"
                disabled={isLoading}
              >
                click here to resend
              </button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create a new account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              sign in to your account
            </Link>
          </p>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {companiesError && (
          <Alert variant="destructive">
            <AlertDescription>Error loading companies: {companiesError}</AlertDescription>
          </Alert>
        )}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <Label htmlFor="full-name" className="sr-only">
                Full Name
              </Label>
              <Input
                id="full-name"
                name="fullName"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="company" className="sr-only">
                Company
              </Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="justify-between"
                    disabled={isLoading}
                    onClick={() => {
                      console.log('Popover button clicked')
                      setOpen(true)
                    }}
                  >
                    {selectedCompany || "Select company..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Search company..." 
                      value={searchTerm}
                      onValueChange={(value) => {
                        console.log('Search term changed:', value)
                        setSearchTerm(value)
                      }}
                    />
                    <CommandList>
                      {isLoadingCompanies ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        <>
                          <CommandEmpty>No company found.</CommandEmpty>
                          <CommandGroup>
                            {companies.map((company) => {
                              console.log('Rendering company:', company.company_name)
                              return (
                                <CommandItem
                                  key={company.id}
                                  value={company.company_name}
                                  onSelect={(currentValue) => {
                                    console.log('CommandItem onSelect called with:', currentValue)
                                    handleCompanySelect(company.company_name)
                                  }}
                                  className="cursor-pointer hover:bg-accent"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedCompany === company.company_name ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {company.company_name}
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            {showCompanyPassword && (
              <div>
                <Label htmlFor="company-password" className="sr-only">
                  Company Password
                </Label>
                <Input
                  id="company-password"
                  name="companyPassword"
                  type="password"
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Company Password"
                  value={companyPassword}
                  onChange={(e) => setCompanyPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            )}
            <div>
              <Label htmlFor="email-address" className="sr-only">
                Email address
              </Label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              {isLoading ? "Creating account..." : "Sign up"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

