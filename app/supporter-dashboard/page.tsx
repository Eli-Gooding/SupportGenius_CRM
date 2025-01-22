"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Bot, BarChart, User, Building2, AlertCircle, Calendar, ArrowUpIcon, ArrowDownIcon } from "lucide-react"
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
  category_id: string
  created_by_user?: {
    id: string
    full_name: string
    company?: {
      id: string
      company_name: string
    }
  }
  category?: {
    id: string
    category_name: string
  }
}

type SortField = keyof Ticket | 'company_name' | 'category_name' | 'customer_name'

interface SortConfig {
  field: SortField
  direction: 'asc' | 'desc'
}

interface FilterConfig {
  priority?: string[]
  ticket_status?: string[]
  category?: string[]
}

function TicketList({ 
  tickets, 
  isLoading, 
  emptyMessage, 
  onTicketClick 
}: { 
  tickets: Ticket[]
  isLoading: boolean
  emptyMessage: string
  onTicketClick?: (ticketId: string) => void
}) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'created_at', direction: 'desc' })
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({})
  const [showFilters, setShowFilters] = useState(false)
  
  const getSortValue = (ticket: Ticket, field: SortConfig['field']) => {
    switch (field) {
      case 'company_name':
        return ticket.created_by_user?.company?.company_name || ''
      case 'customer_name':
        return ticket.created_by_user?.full_name || ''
      case 'category_name':
        return ticket.category?.category_name || ''
      default:
        return ticket[field]
    }
  }

  const sortedAndFilteredTickets = tickets
    .filter(ticket => {
      if (!filterConfig) return true
      return Object.entries(filterConfig).every(([key, values]) => {
        if (!values?.length) return true
        switch (key) {
          case 'priority':
            return values.includes(ticket.priority || 'null')
          case 'ticket_status':
            return values.includes(ticket.ticket_status)
          case 'category':
            return values.includes(ticket.category?.id || '')
          default:
            return true
        }
      })
    })
    .sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.field) ?? ''
      const bVal = getSortValue(b, sortConfig.field) ?? ''
      const modifier = sortConfig.direction === 'asc' ? 1 : -1
      return aVal > bVal ? modifier : -modifier
    })

  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(current => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handleFilter = (key: keyof FilterConfig, value: string) => {
    setFilterConfig(current => ({
      ...current,
      [key]: current[key]?.includes(value)
        ? current[key]?.filter(v => v !== value)
        : [...(current[key] || []), value]
    }))
  }

  const priorities = ['urgent', 'high', 'medium', 'low']
  const statuses = ['new', 'in_progress', 'requires_response', 'closed']

  const uniqueCategories = useMemo(() => {
    return tickets
      .filter((ticket): ticket is Ticket & { category: NonNullable<Ticket['category']> } => 
        ticket.category !== null && ticket.category !== undefined)
      .map(ticket => ({
        id: ticket.category.id,
        name: ticket.category.category_name
      }))
      .filter((category, index, self) => 
        index === self.findIndex(c => c.id === category.id)
      )
  }, [tickets])

  if (isLoading) return <p className="text-center text-gray-500">Loading tickets...</p>
  if (!tickets.length) return <p className="text-center text-gray-500">{emptyMessage}</p>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="mb-2"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
        {filterConfig.priority?.length || filterConfig.ticket_status?.length || filterConfig.category?.length ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterConfig({})}
            className="text-red-500 hover:text-red-700"
          >
            Clear Filters
          </Button>
        ) : null}
      </div>

      {showFilters && (
        <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-md mb-4">
          <div>
            <h4 className="font-medium mb-2">Priority</h4>
            <div className="space-y-2">
              {priorities.map(priority => (
                <label key={priority} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterConfig.priority?.includes(priority) || false}
                    onChange={() => handleFilter('priority', priority)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm capitalize">{priority}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Status</h4>
            <div className="space-y-2">
              {statuses.map(status => (
                <label key={status} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterConfig.ticket_status?.includes(status) || false}
                    onChange={() => handleFilter('ticket_status', status)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Queue</h4>
            <div className="space-y-2">
              {uniqueCategories.map(category => (
                <label key={category.id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filterConfig.category?.includes(category.id) || false}
                    onChange={() => handleFilter('category', category.id)}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">{category.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-t-md font-medium text-sm">
        <div className="col-span-3 cursor-pointer flex items-center gap-1" onClick={() => handleSort('title')}>
          Title
          {sortConfig.field === 'title' && (
            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
          )}
        </div>
        <div className="col-span-2 cursor-pointer flex items-center gap-1" onClick={() => handleSort('customer_name')}>
          Customer
          {sortConfig.field === 'customer_name' && (
            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
          )}
        </div>
        <div className="col-span-2 cursor-pointer flex items-center gap-1" onClick={() => handleSort('company_name')}>
          Company
          {sortConfig.field === 'company_name' && (
            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
          )}
        </div>
        <div className="cursor-pointer flex items-center gap-1" onClick={() => handleSort('category_name')}>
          Queue
          {sortConfig.field === 'category_name' && (
            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
          )}
        </div>
        <div className="col-span-2 cursor-pointer flex items-center gap-1" onClick={() => handleSort('ticket_status')}>
          Status
          {sortConfig.field === 'ticket_status' && (
            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
          )}
        </div>
        <div className="cursor-pointer flex items-center gap-1" onClick={() => handleSort('priority')}>
          Priority
          {sortConfig.field === 'priority' && (
            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
          )}
        </div>
        <div className="cursor-pointer flex items-center gap-1" onClick={() => handleSort('created_at')}>
          Created
          {sortConfig.field === 'created_at' && (
            sortConfig.direction === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />
          )}
        </div>
      </div>
      {sortedAndFilteredTickets.map((ticket) => (
        <Card
          key={ticket.id}
          className={`cursor-pointer hover:bg-gray-50 transition-colors ${onTicketClick ? 'cursor-pointer' : ''}`}
          onClick={() => onTicketClick?.(ticket.id)}
        >
          <CardHeader className="p-4">
            <div className="grid grid-cols-12 gap-4 items-center">
              <div className="col-span-3 font-medium truncate">{ticket.title}</div>
              <div className="col-span-2 text-sm text-gray-500 truncate">
                {ticket.created_by_user?.full_name || 'Unknown'}
              </div>
              <div className="col-span-2 text-sm text-gray-500 truncate">
                {ticket.created_by_user?.company?.company_name || 'Unknown'}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {ticket.category?.category_name || 'Uncategorized'}
              </div>
              <div className="col-span-2 text-sm whitespace-nowrap">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  ticket.ticket_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  ticket.ticket_status === 'requires_response' ? 'bg-yellow-100 text-yellow-800' :
                  ticket.ticket_status === 'closed' ? 'bg-gray-100 text-gray-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {ticket.ticket_status.replace('_', ' ')}
                </span>
              </div>
              <div className="text-sm whitespace-nowrap">
                <span className={`px-2 py-1 rounded-full text-xs ${
                  ticket.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                  ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {ticket.priority || 'low'}
                </span>
              </div>
              <div className="text-sm text-gray-500 whitespace-nowrap">
                {new Date(ticket.created_at).toLocaleDateString()}
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

export default function SupporterDashboard() {
  const [unclaimedCases, setUnclaimedCases] = useState<Ticket[]>([])
  const [activeTickets, setActiveTickets] = useState<Ticket[]>([])
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

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
          ),
          category:category_id (
            id,
            category_name
          )
        `)
        .eq('ticket_status', 'new')
        .order('created_at', { ascending: false })

      if (newTicketsError) throw newTicketsError
      setUnclaimedCases(newTickets || [])

      // Fetch my active tickets
      const { data: myActiveTickets, error: myActiveTicketsError } = await supabase
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
          ),
          category:category_id (
            id,
            category_name
          )
        `)
        .eq('assigned_to_supporter_id', user.user.id)
        .neq('ticket_status', 'closed')
        .order('updated_at', { ascending: false })

      if (myActiveTicketsError) throw myActiveTicketsError
      setActiveTickets(myActiveTickets || [])

      // Fetch my closed tickets
      const { data: myClosedTickets, error: myClosedTicketsError } = await supabase
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
          ),
          category:category_id (
            id,
            category_name
          )
        `)
        .eq('assigned_to_supporter_id', user.user.id)
        .eq('ticket_status', 'closed')
        .order('updated_at', { ascending: false })

      if (myClosedTicketsError) throw myClosedTicketsError
      setClosedTickets(myClosedTickets || [])
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
              <div className="p-4">
                <TicketList
                  tickets={unclaimedCases}
                  isLoading={isLoading}
                  emptyMessage="No unclaimed cases"
                  onTicketClick={setSelectedTicketId}
                />
              </div>
            </ScrollArea>
            {selectedTicketId && (
              <RouteCaseDialog
                ticketId={selectedTicketId}
                onRouteComplete={() => {
                  setSelectedTicketId(null)
                  fetchTickets()
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="my-cases">
            <div className="space-y-4">
              <div className="h-[calc(66vh-250px)] rounded-md border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">Active Cases</h3>
                </div>
                <ScrollArea className="h-[calc(66vh-310px)]">
                  <div className="p-4">
                    <TicketList
                      tickets={activeTickets}
                      isLoading={isLoading}
                      emptyMessage="No active cases"
                      onTicketClick={handleTicketClick}
                    />
                  </div>
                </ScrollArea>
              </div>
              
              <div className="h-[calc(33vh-125px)] rounded-md border">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">Closed Cases</h3>
                </div>
                <ScrollArea className="h-[calc(33vh-185px)]">
                  <div className="p-4">
                    <TicketList
                      tickets={closedTickets}
                      isLoading={isLoading}
                      emptyMessage="No closed cases"
                      onTicketClick={handleTicketClick}
                    />
                  </div>
                </ScrollArea>
              </div>
            </div>
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