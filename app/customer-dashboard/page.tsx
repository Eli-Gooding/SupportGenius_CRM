"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlusCircle, Bot } from "lucide-react"
import { CreateNewCaseDialog } from "@/components/create-new-case-dialog"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"

interface Ticket {
  id: string
  title: string
  ticket_status: 'new' | 'in_progress' | 'requires_response' | 'closed'
  created_at: string
  updated_at: string
}

export default function Dashboard() {
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([])
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([])
  const [isCreateNewCaseOpen, setIsCreateNewCaseOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const fetchTickets = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('created_by_user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      if (tickets) {
        setActiveTickets(tickets.filter(ticket => ticket.ticket_status !== 'closed'))
        setClosedTickets(tickets.filter(ticket => ticket.ticket_status === 'closed'))
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
      toast({
        title: "Error",
        description: "Failed to load tickets. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const handleTicketClick = (ticketId: string) => {
    router.push(`/tickets/${ticketId}`)
  }

  const handleCreateNewCase = async (categoryId: string, description: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert([
          {
            title: description.slice(0, 100), // Use first 100 chars as title
            category_id: categoryId,
            created_by_user_id: session.user.id,
            ticket_status: 'new'
          }
        ])
        .select()
        .single()

      if (error) throw error

      if (ticket) {
        setActiveTickets([ticket, ...activeTickets])
        toast({
          title: "Success",
          description: "New case created successfully.",
        })
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
      toast({
        title: "Error",
        description: "Failed to create new case. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreateNewCaseOpen(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
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
                      <p className="text-sm text-gray-500">Status: {ticket.ticket_status}</p>
                      <p className="text-sm text-gray-500">Created: {new Date(ticket.created_at).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
                {activeTickets.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No active tickets</p>
                )}
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
                      <p className="text-sm text-gray-500">Status: {ticket.ticket_status}</p>
                      <p className="text-sm text-gray-500">Created: {new Date(ticket.created_at).toLocaleDateString()}</p>
                    </CardContent>
                  </Card>
                ))}
                {closedTickets.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No closed tickets</p>
                )}
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

