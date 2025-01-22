"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Bot, BarChart, User, Building2, AlertCircle, Calendar } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { RouteCaseDialog } from "@/components/route-case-dialog"
import { GlobalSearch } from "@/components/global-search"

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

  const fetchTickets = async () => {
    try {
      setIsLoading(true)
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

  useEffect(() => {
    fetchTickets()
  }, [])

  const handleTicketClick = (ticketId: string) => {
    router.push(`/tickets/${ticketId}`)
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-semibold text-gray-900">Supporter Dashboard</h1>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <GlobalSearch />
              <Button
                variant="outline"
                className="flex items-center whitespace-nowrap"
                onClick={() => router.push("/overview")}
              >
                <BarChart className="mr-2 h-4 w-4" /> View Analytics
              </Button>
            </div>
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
                      <CardHeader className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-6 flex-grow">
                            <span className="text-lg font-medium">{ticket.title}</span>
                            <div className="flex items-center space-x-6 text-sm text-gray-500">
                              <div className="flex items-center">
                                <User className="h-4 w-4 mr-1" />
                                <span>{ticket.created_by_user?.full_name || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center">
                                <Building2 className="h-4 w-4 mr-1" />
                                <span>{ticket.created_by_user?.company?.company_name || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center">
                                <AlertCircle className="h-4 w-4 mr-1" />
                                <span>{ticket.priority || 'Not set'}</span>
                              </div>
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <RouteCaseDialog
                            ticketId={ticket.id}
                            onRouteComplete={fetchTickets}
                          />
                        </div>
                      </CardHeader>
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
                      <CardHeader className="p-4">
                        <div className="flex items-center space-x-6">
                          <span className="text-lg font-medium">{ticket.title}</span>
                          <div className="flex items-center space-x-6 text-sm text-gray-500">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-1" />
                              <span>{ticket.created_by_user?.full_name || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center">
                              <Building2 className="h-4 w-4 mr-1" />
                              <span>{ticket.created_by_user?.company?.company_name || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              <span>{ticket.priority || 'Not set'}</span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
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