import type React from "react"
import Link from "next/link"
import { UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-semibold text-blue-600">
            AutoCRM
          </Link>
          <div className="flex items-center">
            <UserCircle className="h-8 w-8 text-gray-400" />
            <span className="ml-2 text-sm text-gray-700">John Doe</span>
            <Button variant="ghost" className="ml-4" asChild>
              <Link href="/login">Logout</Link>
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

