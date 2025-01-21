import type React from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { Inter } from "next/font/google"
import { UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

const inter = Inter({ subsets: ["latin"] })

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const handleLogout = () => {
    // For now, just redirect to login page
    router.push("/login")
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${inter.className}`}>
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-2xl font-semibold text-blue-600">
            AutoCRM
          </Link>
          <div className="flex items-center">
            <UserCircle className="h-8 w-8 text-gray-400" />
            <span className="ml-2 text-sm text-gray-700">John Doe</span>
            <Button variant="ghost" className="ml-4" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

