"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AuthCodeError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Authentication Error</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            There was a problem verifying your email. This could be because:
          </p>
          <ul className="mt-4 list-disc pl-5 text-sm text-gray-600">
            <li>The verification link has expired</li>
            <li>The verification link has already been used</li>
            <li>The verification code is invalid</li>
          </ul>
        </div>
        <div className="mt-6">
          <Link href="/login">
            <Button className="w-full">
              Return to Login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
} 