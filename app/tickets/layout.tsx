"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  Book,
  Settings,
  ShieldCheck,
  LogOut,
} from "lucide-react"
import { AIChatLayout } from "@/components/ai-chat/ai-chat-layout"

interface Supporter {
  id: string
  full_name: string
  is_admin: boolean
}

interface TicketsLayoutProps {
  children: React.ReactNode
}

export default function TicketsLayout({ children }: TicketsLayoutProps) {
  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchSupporter = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: supporter } = await supabase
        .from('supporters')
        .select('id, full_name, is_admin')
        .eq('id', user.id)
        .single()

      if (supporter) {
        setSupporter(supporter)
      }
    }

    fetchSupporter()
  }, [router, supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navigation = [
    {
      name: "Dashboard",
      href: "/supporter-dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Knowledge Base",
      href: "/supporter-knowledge-base",
      icon: Book,
    },
    {
      name: "Settings",
      href: "/supporter-settings",
      icon: Settings,
    },
    ...(supporter?.is_admin ? [
      {
        name: "Admin",
        href: "/supporter-dashboard/admin",
        icon: ShieldCheck,
      },
    ] : []),
  ]

  return (
    <AIChatLayout>
      <div className="flex h-screen">
        {/* Sidebar */}
        <div className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-gray-900">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center h-16 flex-shrink-0 px-4 bg-gray-900">
              <h1 className="text-xl font-bold text-white">SupportGenius</h1>
            </div>
            <ScrollArea className="flex-1 px-3 py-4">
              <nav className="space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Button
                      key={item.name}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-2",
                        isActive
                          ? "bg-gray-800 text-white"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      )}
                      onClick={() => router.push(item.href)}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Button>
                  )
                })}
              </nav>
            </ScrollArea>
            <div className="flex-shrink-0 flex border-t border-gray-800 p-4">
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-gray-300 hover:bg-gray-800 hover:text-white"
                onClick={handleSignOut}
              >
                <LogOut className="h-5 w-5" />
                Sign out
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:pl-72 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </AIChatLayout>
  )
} 