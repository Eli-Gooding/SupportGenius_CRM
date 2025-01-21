"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

export default function AuthCodeError() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Authentication Error</h2>
          <div className="mt-4 text-gray-600 space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                There was a problem verifying your email address. This could be because:
              </AlertDescription>
            </Alert>
            <ul className="text-left list-disc pl-5 space-y-2">
              <li>The confirmation link has expired</li>
              <li>The confirmation link has already been used</li>
              <li>The confirmation link is invalid</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={() => router.push("/signup")}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try signing up again
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
            Need help? Please{" "}
            <a href="mailto:support@example.com" className="font-medium text-blue-600 hover:text-blue-500">
              contact support
            </a>
            {" "}and we'll help you get started.
          </p>
        </div>
      </div>
    </div>
  )
} 