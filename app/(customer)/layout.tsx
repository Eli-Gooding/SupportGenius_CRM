import { Sidebar } from "@/components/navigation/sidebar"

interface CustomerLayoutProps {
  children: React.ReactNode
}

export default function CustomerLayout({ children }: CustomerLayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar userType="customer" className="border-r" />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
} 