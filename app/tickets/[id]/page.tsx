"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import { User, Building2, AlertCircle, Calendar, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface SupabaseMessage {
  id: string
  content: string
  created_at: string
  sender_type: 'user' | 'supporter'
  sender: Array<{
    id: string
    full_name: string
  }>
}

interface Message {
  id: string
  content: string
  created_at: string
  sender_type: 'user' | 'supporter'
  sender: {
    id: string
    full_name: string
  } | null
}

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
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const fetchMessages = async () => {
    try {
      // First get messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('ticket_id', params.id)
        .order('created_at', { ascending: true })

      if (messagesError) throw messagesError

      // Get unique sender IDs grouped by sender type
      const supporterIds = [...new Set(messages?.filter(m => m.sender_type === 'supporter').map(m => m.sender_id) || [])]
      const userIds = [...new Set(messages?.filter(m => m.sender_type === 'user').map(m => m.sender_id) || [])]

      // Fetch supporters
      const { data: supporters, error: supportersError } = await supabase
        .from('supporters')
        .select('id, full_name')
        .in('id', supporterIds)

      if (supportersError) throw supportersError

      // Fetch users
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', userIds)

      if (usersError) throw usersError

      // Create maps for both types of senders
      const supporterMap = new Map(supporters?.map(s => [s.id, s]))
      const userMap = new Map(users?.map(u => [u.id, u]))

      // Combine the data
      const combinedMessages = messages?.map(msg => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        sender_type: msg.sender_type,
        sender: msg.sender_type === 'supporter' 
          ? supporterMap.get(msg.sender_id) || null
          : userMap.get(msg.sender_id) || null
      })) || []

      setMessages(combinedMessages)
    } catch (error) {
      console.error('Error fetching messages:', error)
      toast({
        title: "Error",
        description: "Failed to load messages. Please try refreshing the page.",
        variant: "destructive",
      })
    }
  }

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
        await fetchMessages()
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
    if (!newMessage.trim()) return

    setIsSending(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError

      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          ticket_id: params.id,
          content: newMessage.trim(),
          sender_type: 'supporter',
          sender_id: userData.user.id,
        })

      if (messageError) throw messageError

      // Update ticket status to indicate supporter response
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({ 
          ticket_status: 'requires_response',
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (ticketError) throw ticketError

      setNewMessage("")
      await fetchMessages() // Refresh messages
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      })
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
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
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <p className="text-sm text-gray-500">No messages yet.</p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex flex-col ${
                          message.sender_type === 'supporter' ? 'items-end' : 'items-start'
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.sender_type === 'supporter'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm font-medium mb-1">
                            {message.sender?.full_name || 'Unknown'}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs mt-1 opacity-75">
                            {new Date(message.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
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
                    disabled={isSending}
                  />
                  <Button type="submit" className="ml-2" disabled={isSending || !newMessage.trim()}>
                    {isSending ? "Sending..." : "Send"}
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

