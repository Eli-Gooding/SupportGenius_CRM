"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlusCircle, Bot } from "lucide-react"
import { CreateNewCaseDialog } from "@/components/create-new-case-dialog"

// Sample ticket data
const tickets = [
  { id: 1, title: "Cannot access account", status: "Open", createdAt: "2023-05-01" },
  { id: 2, title: "Feature request: Dark mode", status: "Closed", createdAt: "2023-04-28" },
  { id: 3, title: "Bug in reporting module", status: "Open", createdAt: "2023-04-30" },
  { id: 4, title: "Update user profile", status: "Open", createdAt: "2023-05-02" },
  { id: 5, title: "Password reset not working", status: "Closed", createdAt: "2023-04-25" },
  { id: 6, title: "Add export to PDF feature", status: "Open", createdAt: "2023-05-03" },
  { id: 7, title: "Mobile app crashing", status: "Open", createdAt: "2023-05-04" },
  { id: 8, title: "Incorrect billing amount", status: "Closed", createdAt: "2023-04-22" },
  { id: 9, title: "Update terms of service", status: "Open", createdAt: "2023-05-05" },
  { id: 10, title: "Slow loading times", status: "Closed", createdAt: "2023-04-20" },
]

export default function Dashboard() {
  const [activeTickets, setActiveTickets] = useState(tickets.filter((ticket) => ticket.status === "Open"))
  const [closedTickets, setClosedTickets] = useState(tickets.filter((ticket) => ticket.status === "Closed"))
  const [isCreateNewCaseOpen, setIsCreateNewCaseOpen] = useState(false)
  const router = useRouter()

  const handleTicketClick = (ticketId: number) => {
    router.push(`/tickets/${ticketId}`)
  }

  const handleCreateNewCase = (category: string, description: string) => {
    // Here you would typically send the new case data to your backend
    console.log("New case created:", { category, description })
    // For now, let's just add it to the active tickets
    const newTicket = {
      id: tickets.length + 1,
      title: description.slice(0, 50) + (description.length > 50 ? "..." : ""),
      status: "Open",
      createdAt: new Date().toISOString().split("T")[0],
    }
    setActiveTickets([newTicket, ...activeTickets])
    setIsCreateNewCaseOpen(false)
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => console.log("Ask SupportGenius AI clicked")}
            >
              <Bot className="mr-2 h-4 w-4" /> Ask SupportGenius AI
            </Button>
            <Button className="flex items-center" onClick={() => setIsCreateNewCaseOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Case
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Active Tickets</h2>
            <ScrollArea className="h-[calc(100vh-200px)] rounded-md border">
              <div className="p-4 space-y-4">
                {activeTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{ticket.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500">Status: {ticket.status}</p>
                      <p className="text-sm text-gray-500">Created: {ticket.createdAt}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">Closed Tickets</h2>
            <ScrollArea className="h-[calc(100vh-200px)] rounded-md border">
              <div className="p-4 space-y-4">
                {closedTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleTicketClick(ticket.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{ticket.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500">Status: {ticket.status}</p>
                      <p className="text-sm text-gray-500">Created: {ticket.createdAt}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
      <CreateNewCaseDialog
        isOpen={isCreateNewCaseOpen}
        onClose={() => setIsCreateNewCaseOpen(false)}
        onSubmit={handleCreateNewCase}
      />
    </div>
  )
}

