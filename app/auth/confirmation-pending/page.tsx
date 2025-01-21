"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function ConfirmationPending() {
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [resendSuccess, setResendSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleResendEmail = async () => {
    setIsResending(true)
    setError("")
    setResendSuccess(false)

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: '', // Supabase will use the email from the most recent signup
      })

      if (resendError) {
        setError(resendError.message)
      } else {
        setResendSuccess(true)
      }
    } catch (err) {
      console.error("Error resending confirmation email:", err)
      setError("An unexpected error occurred while resending the confirmation email")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Check your email</h2>
          <div className="mt-4 text-center text-gray-600 space-y-2">
            <p>
              We've sent you a confirmation email. Please click the link in the email to verify your account.
            </p>
            <p className="text-sm">
              After confirming your email, you'll be able to sign in to your account.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {resendSuccess && (
          <Alert>
            <AlertDescription>Confirmation email has been resent. Please check your inbox.</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Button
            onClick={handleResendEmail}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isResending}
          >
            {isResending ? "Resending..." : "Resend confirmation email"}
          </Button>

          <Button
            onClick={() => router.push("/login")}
            variant="outline"
            className="w-full"
          >
            Return to login
          </Button>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>
            Having trouble? Make sure to check your spam folder. If you still need help,{" "}
            <a href="mailto:support@example.com" className="font-medium text-blue-600 hover:text-blue-500">
              contact support
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
} 