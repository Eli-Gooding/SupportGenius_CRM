import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, BookOpen, Settings, Users } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

interface SidebarProps {
  className?: string
  userType: "customer" | "supporter"
}

export function Sidebar({ className, userType }: SidebarProps) {
  const pathname = usePathname()

  const customerLinks = [
    {
      name: "Dashboard",
      href: "/customer-dashboard",
      icon: LayoutDashboard
    },
    {
      name: "Knowledge Base",
      href: "/customer-knowledge-base",
      icon: BookOpen
    },
    {
      name: "Account Settings",
      href: "/customer-settings",
      icon: Settings
    }
  ]

  const supporterLinks = [
    {
      name: "Dashboard",
      href: "/supporter-dashboard",
      icon: LayoutDashboard
    },
    {
      name: "Customers",
      href: "/supporter-customers",
      icon: Users
    },
    {
      name: "Knowledge Base",
      href: "/supporter-knowledge-base",
      icon: BookOpen
    },
    {
      name: "Account Settings",
      href: "/supporter-settings",
      icon: Settings
    }
  ]

  const links = userType === "customer" ? customerLinks : supporterLinks

  return (
    <div className={cn("pb-12 w-64", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <div className="space-y-1">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={pathname === link.href ? "secondary" : "ghost"}
                  className="w-full justify-start"
                >
                  <link.icon className="mr-2 h-4 w-4" />
                  {link.name}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 