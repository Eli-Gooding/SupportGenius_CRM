"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { User, Building2, Calendar, Clock, Copy, Check } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { GlobalSearch } from "@/components/global-search"

interface CustomerTicket {
  id: string
  title: string
  ticket_status: 'new' | 'in_progress' | 'requires_response' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
  created_at: string
  updated_at: string
}

interface CustomerInfo {
  id: string
  email: string
  full_name: string
  created_at: string
  last_login: string | null
  company: {
    id: string
    company_name: string
  } | null
}

export default function CustomerInfo({ params }: { params: { id: string } }) {
  const [customer, setCustomer] = useState<CustomerInfo | null>(null)
  const [tickets, setTickets] = useState<CustomerTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCopied, setIsCopied] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  const handleCopyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
    toast({
      title: "Link copied",
      description: "Customer page link has been copied to clipboard",
    })
  }

  useEffect(() => {
    const fetchCustomerInfo = async () => {
      try {
        // Fetch customer details
        const { data: customerData, error: customerError } = await supabase
          .from('users')
          .select(`
            *,
            company:company_id (
              id,
              company_name
            )
          `)
          .eq('id', params.id)
          .single()

        if (customerError) throw customerError
        if (!customerData) {
          setCustomer(null)
          setIsLoading(false)
          return
        }

        setCustomer(customerData as CustomerInfo)

        // Fetch customer's tickets
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select('*')
          .eq('created_by_user_id', params.id)
          .order('created_at', { ascending: false })

        if (ticketsError) throw ticketsError
        setTickets(ticketsData as CustomerTicket[])

      } catch (error) {
        console.error('Error fetching customer info:', error)
        toast({
          title: "Error",
          description: "Failed to load customer information.",
          variant: "destructive",
        })
        setCustomer(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCustomerInfo()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading customer information...</p>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <p className="text-gray-500">Customer not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-4">
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
        <GlobalSearch />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CardTitle className="text-2xl">{customer.full_name}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyLink}
                  className="ml-1"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-500">
                  <User className="h-4 w-4 mr-2" />
                  <span className="font-medium mr-2">Email:</span>
                  <span>{customer.email}</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Building2 className="h-4 w-4 mr-2" />
                  <span className="font-medium mr-2">Company:</span>
                  {customer.company ? (
                    <Link 
                      href={`/account/${customer.company.id}`}
                      className="hover:text-blue-600 hover:underline"
                    >
                      {customer.company.company_name}
                    </Link>
                  ) : (
                    <span>Not specified</span>
                  )}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="font-medium mr-2">Account Created:</span>
                  <span>{new Date(customer.created_at).toLocaleString()}</span>
                </div>
                {customer.last_login && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="h-4 w-4 mr-2" />
                    <span className="font-medium mr-2">Last Login:</span>
                    <span>{new Date(customer.last_login).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-500">
                  <span className="font-medium mr-2">Customer ID:</span>
                  <code className="bg-gray-100 px-2 py-1 rounded">{customer.id}</code>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Tickets History</h3>
              {tickets.length === 0 ? (
                <p className="text-sm text-gray-500">No tickets found for this customer.</p>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <Card key={ticket.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{ticket.title}</h4>
                            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                              <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
                              <span>•</span>
                              <span>Updated: {new Date(ticket.updated_at).toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <span className={`text-sm px-2 py-1 rounded ${
                              ticket.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              ticket.priority === 'low' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {ticket.priority ? ticket.priority.toUpperCase() : 'NO PRIORITY'}
                            </span>
                            <span className={`text-sm px-2 py-1 rounded ${
                              ticket.ticket_status === 'new' ? 'bg-blue-100 text-blue-800' :
                              ticket.ticket_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                              ticket.ticket_status === 'requires_response' ? 'bg-red-100 text-red-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {ticket.ticket_status.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 