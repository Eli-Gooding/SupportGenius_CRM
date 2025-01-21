"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { Building2, Calendar, User, Ticket } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface CompanyInfo {
  id: string
  company_name: string
  created_at: string
}

interface CompanyEmployee {
  id: string
  email: string
  full_name: string
  created_at: string
  last_login: string | null
}

interface CompanyTicket {
  id: string
  title: string
  ticket_status: 'new' | 'in_progress' | 'requires_response' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
  created_at: string
  updated_at: string
  created_by_user: {
    full_name: string
  }
  assigned_to_supporter: {
    full_name: string
  } | null
}

export default function AccountInfo({ params }: { params: { id: string } }) {
  const [company, setCompany] = useState<CompanyInfo | null>(null)
  const [employees, setEmployees] = useState<CompanyEmployee[]>([])
  const [tickets, setTickets] = useState<CompanyTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const fetchAccountInfo = async () => {
      try {
        // Fetch company details
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', params.id)
          .single()

        if (companyError) throw companyError
        if (!companyData) {
          setCompany(null)
          setIsLoading(false)
          return
        }

        setCompany(companyData as CompanyInfo)

        // Fetch employees
        const { data: employeesData, error: employeesError } = await supabase
          .from('users')
          .select('id, email, full_name, created_at, last_login')
          .eq('company_id', params.id)
          .order('full_name', { ascending: true })

        if (employeesError) throw employeesError
        setEmployees(employeesData as CompanyEmployee[])

        // Fetch tickets
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select(`
            id,
            title,
            ticket_status,
            priority,
            created_at,
            updated_at,
            created_by_user:users!created_by_user_id (
              full_name
            ),
            assigned_to_supporter:supporters!assigned_to_supporter_id (
              full_name
            )
          `)
          .in('created_by_user_id', employeesData.map(emp => emp.id))
          .order('created_at', { ascending: false })

        if (ticketsError) throw ticketsError
        setTickets(ticketsData as CompanyTicket[])

      } catch (error) {
        console.error('Error fetching account info:', error)
        toast({
          title: "Error",
          description: "Failed to load account information.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchAccountInfo()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading account information...</p>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <p className="text-gray-500">Account not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{company.company_name}</h1>
      </div>

      <Tabs defaultValue="account" className="space-y-4">
        <TabsList>
          <TabsTrigger value="account">Account Info</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-sm text-gray-500">
                <Building2 className="h-4 w-4 mr-2" />
                <span className="font-medium mr-2">Company Name:</span>
                <span>{company.company_name}</span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="h-4 w-4 mr-2" />
                <span className="font-medium mr-2">Account Created:</span>
                <span>{new Date(company.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <span className="font-medium mr-2">Account ID:</span>
                <code className="bg-gray-100 px-2 py-1 rounded">{company.id}</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Employees ({employees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {employees.map((employee) => (
                  <Card key={employee.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <Link 
                            href={`/customer/${employee.id}`}
                            className="text-lg font-medium hover:text-blue-600 hover:underline"
                          >
                            {employee.full_name}
                          </Link>
                          <div className="mt-1 space-y-1 text-sm text-gray-500">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2" />
                              <span>{employee.email}</span>
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-2" />
                              <span>Joined: {new Date(employee.created_at).toLocaleString()}</span>
                            </div>
                            {employee.last_login && (
                              <div className="flex items-center text-gray-400">
                                <span>Last login: {new Date(employee.last_login).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Tickets ({tickets.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{ticket.title}</h4>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                            <span>Created by: {ticket.created_by_user.full_name}</span>
                            {ticket.assigned_to_supporter && (
                              <>
                                <span>•</span>
                                <span>Assigned to: {ticket.assigned_to_supporter.full_name}</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-4">
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>
    </div>
  )
} 