"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { Loader2, ArrowLeft } from "lucide-react"
import { PostgrestResponse } from '@supabase/supabase-js'
import { Database } from '@/lib/database.types'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Tables = Database['public']['Tables']

type DbTicket = Tables['tickets']['Row'] & {
  created_by_user: Pick<Tables['users']['Row'], 'full_name'> | null
}

type DbUser = Tables['users']['Row'] & {
  company: Pick<Tables['companies']['Row'], 'company_name'> | null
}

type DbSupporter = Tables['supporters']['Row']
type DbCompany = Tables['companies']['Row']

interface SearchResults {
  tickets: DbTicket[]
  customers: DbUser[]
  supporters: DbSupporter[]
  companies: DbCompany[]
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get("q") || ""
  const [activeTab, setActiveTab] = React.useState("tickets")
  const [isLoading, setIsLoading] = React.useState(true)
  const [results, setResults] = React.useState<SearchResults>({
    tickets: [],
    customers: [],
    supporters: [],
    companies: []
  })
  const [filters, setFilters] = React.useState({
    tickets: {
      status: "all",
      priority: "all"
    },
    customers: {
      company: "all"
    }
  })

  const supabase = createClient()
  const router = useRouter()

  const performSearch = React.useCallback(async () => {
    if (!query) return

    setIsLoading(true)
    try {
      const formattedQuery = query.trim().split(/\s+/).join(' & ')

      const [ticketsRes, customersRes, supportersRes, companiesRes] = await Promise.all([
        supabase
          .from('tickets')
          .select(`
            id,
            title,
            ticket_status,
            priority,
            created_at,
            updated_at,
            closed_at,
            category_id,
            created_by_user_id,
            assigned_to_supporter_id,
            created_by_user:users!created_by_user_id (
              full_name
            )
          `)
          .textSearch('search_vector', formattedQuery)
          .limit(50)
          .order('created_at', { ascending: false }),

        supabase
          .from('users')
          .select(`
            id,
            full_name,
            email,
            company_id,
            created_at,
            last_login,
            company:companies!company_id (
              company_name
            )
          `)
          .textSearch('search_vector', formattedQuery)
          .limit(50)
          .order('created_at', { ascending: false }),

        supabase
          .from('supporters')
          .select('*')
          .textSearch('search_vector', formattedQuery)
          .limit(50)
          .order('created_at', { ascending: false }),

        supabase
          .from('companies')
          .select('*')
          .textSearch('search_vector', formattedQuery)
          .limit(50)
          .order('created_at', { ascending: false })
      ]) as [
        PostgrestResponse<DbTicket>,
        PostgrestResponse<DbUser>,
        PostgrestResponse<DbSupporter>,
        PostgrestResponse<DbCompany>
      ]

      setResults({
        tickets: ticketsRes.data || [],
        customers: customersRes.data || [],
        supporters: supportersRes.data || [],
        companies: companiesRes.data || []
      })
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [query, supabase])

  React.useEffect(() => {
    performSearch()
  }, [performSearch])

  const filteredResults = React.useMemo(() => {
    return {
      tickets: results.tickets.filter(ticket => {
        if (filters.tickets.status !== 'all' && ticket.ticket_status !== filters.tickets.status) return false
        if (filters.tickets.priority !== 'all' && ticket.priority !== filters.tickets.priority) return false
        return true
      }),
      customers: results.customers.filter(customer => {
        if (filters.customers.company !== 'all' && customer.company?.company_name !== filters.customers.company) return false
        return true
      }),
      supporters: results.supporters,
      companies: results.companies
    }
  }, [results, filters])

  const uniqueCompanies = React.useMemo(() => {
    const companies = new Set<string>()
    results.customers.forEach(customer => {
      if (customer.company?.company_name) {
        companies.add(customer.company.company_name)
      }
    })
    return Array.from(companies)
  }, [results.customers])

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
        </div>
      </div>

      <Card className="mt-4">
        <div className="px-4 py-5 sm:px-6">
          <h1 className="text-3xl font-semibold">
            Search Results for "{query}"
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tickets">
              Tickets ({filteredResults.tickets.length})
            </TabsTrigger>
            <TabsTrigger value="customers">
              Customers ({filteredResults.customers.length})
            </TabsTrigger>
            <TabsTrigger value="supporters">
              Supporters ({filteredResults.supporters.length})
            </TabsTrigger>
            <TabsTrigger value="companies">
              Companies ({filteredResults.companies.length})
            </TabsTrigger>
          </TabsList>

          <Card className="mt-4">
            <TabsContent value="tickets" className="m-0">
              <div className="p-4 border-b space-x-4 flex">
                <Select
                  value={filters.tickets.status}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      tickets: { ...prev.tickets, status: value }
                    }))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="requires_response">Requires Response</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.tickets.priority}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      tickets: { ...prev.tickets, priority: value }
                    }))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created By</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.tickets.map((ticket) => (
                    <TableRow 
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/tickets/${ticket.id}`)}
                    >
                      <TableCell>{ticket.title}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            ticket.ticket_status === 'new' ? 'default' :
                            ticket.ticket_status === 'in_progress' ? 'secondary' :
                            ticket.ticket_status === 'requires_response' ? 'destructive' :
                            'outline'
                          }
                        >
                          {ticket.ticket_status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ticket.priority && (
                          <Badge 
                            variant={
                              ticket.priority === 'urgent' ? 'destructive' :
                              ticket.priority === 'high' ? 'destructive' :
                              ticket.priority === 'medium' ? 'secondary' :
                              'outline'
                            }
                          >
                            {ticket.priority}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{ticket.created_by_user?.full_name || 'Unknown'}</TableCell>
                      <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="customers" className="m-0">
              <div className="p-4 border-b space-x-4 flex">
                <Select
                  value={filters.customers.company}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      customers: { ...prev.customers, company: value }
                    }))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by company" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {uniqueCompanies.map(company => (
                      <SelectItem key={company} value={company}>
                        {company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.customers.map((customer) => (
                    <TableRow 
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/customer/${customer.id}`)}
                    >
                      <TableCell>{customer.full_name}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>
                        {customer.company?.company_name ? (
                          <Badge variant="outline">
                            {customer.company.company_name}
                          </Badge>
                        ) : 'N/A'}
                      </TableCell>
                      <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="supporters" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.supporters.map((supporter) => (
                    <TableRow 
                      key={supporter.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/supporter/${supporter.id}`)}
                    >
                      <TableCell>{supporter.full_name}</TableCell>
                      <TableCell>{supporter.email}</TableCell>
                      <TableCell>{new Date(supporter.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="companies" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.companies.map((company) => (
                    <TableRow 
                      key={company.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/account/${company.id}`)}
                    >
                      <TableCell>
                        <Badge variant="outline">
                          {company.company_name}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(company.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Card>
        </Tabs>
      </Card>
    </div>
  )
} 