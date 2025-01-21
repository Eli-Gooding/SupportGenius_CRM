"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { User, Building2, AlertCircle, Calendar, Clock } from "lucide-react"

interface Ticket {
  id: string
  title: string
  ticket_status: 'new' | 'in_progress' | 'requires_response' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
  created_at: string
  updated_at: string
  created_by_user: {
    full_name: string
    company: {
      company_name: string
    } | null
  } | null
  assigned_to_supporter: {
    full_name: string
  } | null
}

export default function TicketDetails({ params }: { params: { id: string } }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            created_by_user:created_by_user_id (
              full_name,
              company:company_id (
                company_name
              )
            ),
            assigned_to_supporter:assigned_to_supporter_id (
              full_name
            )
          `)
          .eq('id', params.id)
          .single()

        if (ticketError) throw ticketError
        if (!ticketData) {
          router.push("/supporter-dashboard")
          return
        }

        setTicket(ticketData as Ticket)
      } catch (error) {
        console.error('Error fetching ticket:', error)
        router.push("/supporter-dashboard")
      } finally {
        setIsLoading(false)
      }
    }

    fetchTicket()
  }, [params.id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would typically send the new message to your backend
    console.log("New message:", newMessage)
    setNewMessage("")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading ticket details...</p>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Ticket not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl mb-2">{ticket.title}</CardTitle>
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
                  <span>Priority: {ticket.priority || 'Not set'}</span>
                </div>
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-500 mt-2">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>Updated: {new Date(ticket.updated_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">Status</div>
              <div className={`mt-1 text-sm ${
                ticket.ticket_status === 'new' ? 'text-blue-600' :
                ticket.ticket_status === 'in_progress' ? 'text-yellow-600' :
                ticket.ticket_status === 'requires_response' ? 'text-red-600' :
                'text-green-600'
              }`}>
                {ticket.ticket_status.replace('_', ' ').toUpperCase()}
              </div>
              {ticket.assigned_to_supporter && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-gray-900">Assigned To</div>
                  <div className="text-sm text-gray-500">{ticket.assigned_to_supporter.full_name}</div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Messages</h3>
              {/* Here you would map through and display messages */}
              <p className="text-sm text-gray-500 mb-4">No messages yet.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="new-message">New Message</Label>
                <div className="flex mt-2">
                  <Input
                    id="new-message"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-grow"
                  />
                  <Button type="submit" className="ml-2">
                    Send
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
      <div className="mt-4">
        <Button variant="outline" onClick={() => router.push("/supporter-dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}

