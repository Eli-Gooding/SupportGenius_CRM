"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Bot, BarChart } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Ticket {
  id: string
  title: string
  ticket_status: 'new' | 'in_progress' | 'requires_response' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
  created_at: string
  updated_at: string
  created_by_user_id: string
  assigned_to_supporter_id: string | null
  created_by_user?: {
    id: string
    full_name: string
    company?: {
      id: string
      company_name: string
    }
  }
}

export default function SupporterDashboard() {
  const [unclaimedCases, setUnclaimedCases] = useState<Ticket[]>([])
  const [myCases, setMyCases] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        // Fetch unclaimed tickets (status = 'new')
        const { data: newTickets, error: newTicketsError } = await supabase
          .from('tickets')
          .select(`
            *,
            created_by_user:created_by_user_id (
              id,
              full_name,
              company:company_id (
                id,
                company_name
              )
            )
          `)
          .eq('ticket_status', 'new')
          .order('created_at', { ascending: false })

        if (newTicketsError) throw newTicketsError
        setUnclaimedCases(newTickets || [])

        // Fetch my assigned tickets (status != 'new')
        const { data: myTickets, error: myTicketsError } = await supabase
          .from('tickets')
          .select(`
            *,
            created_by_user:created_by_user_id (
              id,
              full_name,
              company:company_id (
                id,
                company_name
              )
            )
          `)
          .neq('ticket_status', 'new')
          .order('updated_at', { ascending: false })

        if (myTicketsError) throw myTicketsError
        setMyCases(myTickets || [])
      } catch (error) {
        console.error('Error fetching tickets:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTickets()
  }, [])

  const handleTicketClick = (ticketId: string) => {
    router.push(`/tickets/${ticketId}`)
  }

  const handleClaimTicket = async (ticketId: string) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('No authenticated user')

      // Update ticket assignment in the database
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          ticket_status: 'in_progress',
          assigned_to_supporter_id: user.id
        })
        .eq('id', ticketId)

      if (updateError) throw updateError

      // Update local state
      const ticket = unclaimedCases.find(t => t.id === ticketId)
      if (ticket) {
        setUnclaimedCases(unclaimedCases.filter(t => t.id !== ticketId))
        setMyCases([{ ...ticket, ticket_status: 'in_progress' }, ...myCases])
      }
    } catch (error) {
      console.error('Error claiming ticket:', error)
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Supporter Dashboard</h1>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              className="flex items-center"
              onClick={() => router.push("/overview")}
            >
              <BarChart className="mr-2 h-4 w-4" /> View Analytics
            </Button>
          </div>
        </div>

        <Tabs defaultValue="unclaimed" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="unclaimed">Unclaimed Cases</TabsTrigger>
            <TabsTrigger value="my-cases">My Cases</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="unclaimed">
            <ScrollArea className="h-[calc(100vh-250px)] rounded-md border">
              <div className="p-4 space-y-4">
                {isLoading ? (
                  <p className="text-center text-gray-500">Loading tickets...</p>
                ) : unclaimedCases.length === 0 ? (
                  <p className="text-center text-gray-500">No unclaimed cases</p>
                ) : (
                  unclaimedCases.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <CardHeader>
                        <CardTitle className="text-lg flex justify-between">
                          <span>{ticket.title}</span>
                          <Button onClick={() => handleClaimTicket(ticket.id)}>Claim Case</Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-500">Customer: {ticket.created_by_user?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">Company: {ticket.created_by_user?.company?.company_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">Priority: {ticket.priority || 'Not set'}</p>
                        <p className="text-sm text-gray-500">Created: {new Date(ticket.created_at).toLocaleDateString()}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="my-cases">
            <ScrollArea className="h-[calc(100vh-250px)] rounded-md border">
              <div className="p-4 space-y-4">
                {isLoading ? (
                  <p className="text-center text-gray-500">Loading tickets...</p>
                ) : myCases.length === 0 ? (
                  <p className="text-center text-gray-500">No assigned cases</p>
                ) : (
                  myCases.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleTicketClick(ticket.id)}
                    >
                      <CardHeader>
                        <CardTitle className="text-lg">{ticket.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-500">Customer: {ticket.created_by_user?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">Company: {ticket.created_by_user?.company?.company_name || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">Status: {ticket.ticket_status}</p>
                        <p className="text-sm text-gray-500">Priority: {ticket.priority || 'Not set'}</p>
                        <p className="text-sm text-gray-500">Created: {new Date(ticket.created_at).toLocaleDateString()}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="overview">
            <div className="h-[calc(100vh-250px)] rounded-md border p-4">
              <h2 className="text-xl font-semibold mb-4">Analytics Overview</h2>
              <p className="text-gray-500">Analytics dashboard coming soon...</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
} 