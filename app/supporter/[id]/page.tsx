"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { User, Calendar, Clock, Mail, Star } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SupporterInfo {
  id: string
  email: string
  full_name: string
  created_at: string
  last_login: string | null
}

interface AssignedTicket {
  id: string
  title: string
  ticket_status: 'new' | 'in_progress' | 'requires_response' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
  created_at: string
  updated_at: string
  created_by_user: {
    id: string
    full_name: string
    company: {
      id: string
      company_name: string
    } | null
  }
}

interface TicketMetrics {
  total: number
  active: number
  closed: number
  avgResponseTime?: number
  byPriority: {
    urgent: number
    high: number
    medium: number
    low: number
    unset: number
  }
  byStatus: {
    new: number
    in_progress: number
    requires_response: number
    closed: number
  }
}

interface SupporterRating {
  id: string
  rating: number
  review: string | null
  created_at: string
  ticket: {
    id: string
    title: string
  }
}

interface SupporterStats {
  average_rating: number
  total_ratings: number
}

export default function SupporterInfo({ params }: { params: { id: string } }) {
  const [supporter, setSupporter] = useState<SupporterInfo | null>(null)
  const [tickets, setTickets] = useState<AssignedTicket[]>([])
  const [metrics, setMetrics] = useState<TicketMetrics>({
    total: 0,
    active: 0,
    closed: 0,
    byPriority: { urgent: 0, high: 0, medium: 0, low: 0, unset: 0 },
    byStatus: { new: 0, in_progress: 0, requires_response: 0, closed: 0 }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [ratings, setRatings] = useState<SupporterRating[]>([])
  const [stats, setStats] = useState<SupporterStats | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const fetchSupporterInfo = async () => {
      try {
        // Fetch supporter details
        const { data: supporterData, error: supporterError } = await supabase
          .from('supporters')
          .select('*')
          .eq('id', params.id)
          .single()

        if (supporterError) throw supporterError
        if (!supporterData) {
          setSupporter(null)
          setIsLoading(false)
          return
        }

        setSupporter(supporterData as SupporterInfo)

        // Fetch assigned tickets
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
              id,
              full_name,
              company:companies!company_id (
                id,
                company_name
              )
            )
          `)
          .eq('assigned_to_supporter_id', params.id)
          .order('created_at', { ascending: false })

        if (ticketsError) throw ticketsError

        // Transform tickets data to match interface
        const transformedTickets: AssignedTicket[] = (ticketsData || []).map(ticket => ({
          id: ticket.id,
          title: ticket.title,
          ticket_status: ticket.ticket_status,
          priority: ticket.priority,
          created_at: ticket.created_at,
          updated_at: ticket.updated_at,
          created_by_user: {
            id: ticket.created_by_user?.id,
            full_name: ticket.created_by_user?.full_name,
            company: ticket.created_by_user?.company ? {
              id: ticket.created_by_user.company.id,
              company_name: ticket.created_by_user.company.company_name
            } : null
          }
        }))

        setTickets(transformedTickets)

        // Calculate metrics
        const ticketMetrics: TicketMetrics = {
          total: ticketsData?.length || 0,
          active: ticketsData?.filter(t => t.ticket_status !== 'closed').length || 0,
          closed: ticketsData?.filter(t => t.ticket_status === 'closed').length || 0,
          byPriority: {
            urgent: ticketsData?.filter(t => t.priority === 'urgent').length || 0,
            high: ticketsData?.filter(t => t.priority === 'high').length || 0,
            medium: ticketsData?.filter(t => t.priority === 'medium').length || 0,
            low: ticketsData?.filter(t => t.priority === 'low').length || 0,
            unset: ticketsData?.filter(t => t.priority === null).length || 0,
          },
          byStatus: {
            new: ticketsData?.filter(t => t.ticket_status === 'new').length || 0,
            in_progress: ticketsData?.filter(t => t.ticket_status === 'in_progress').length || 0,
            requires_response: ticketsData?.filter(t => t.ticket_status === 'requires_response').length || 0,
            closed: ticketsData?.filter(t => t.ticket_status === 'closed').length || 0,
          }
        }
        setMetrics(ticketMetrics)

        // Fetch supporter ratings stats
        const { data: statsData, error: statsError } = await supabase
          .rpc('get_supporter_average_rating', {
            supporter_uuid: params.id
          })

        if (statsError) throw statsError
        if (statsData && statsData.length > 0) {
          setStats(statsData[0])
        }

        // Fetch all ratings for this supporter
        const { data: ratingsData, error: ratingsError } = await supabase
          .from('supporter_ratings')
          .select(`
            id,
            rating,
            review,
            created_at,
            ticket:tickets!ticket_id (
              id,
              title
            )
          `)
          .eq('supporter_id', params.id)
          .order('created_at', { ascending: false })

        if (ratingsError) throw ratingsError

        // Transform ratings data to match interface
        const transformedRatings: SupporterRating[] = (ratingsData || []).map(rating => ({
          id: rating.id,
          rating: rating.rating,
          review: rating.review,
          created_at: rating.created_at,
          ticket: {
            id: rating.ticket?.id,
            title: rating.ticket?.title
          }
        }))

        setRatings(transformedRatings)

      } catch (error) {
        console.error('Error fetching supporter info:', error)
        toast({
          title: "Error",
          description: "Failed to load supporter information.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchSupporterInfo()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading supporter information...</p>
      </div>
    )
  }

  if (!supporter) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <p className="text-gray-500">Supporter not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{supporter.full_name}</h1>
      </div>

      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Supporter Info</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="tickets">Assigned Tickets</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Supporter Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center text-sm text-gray-500">
                <User className="h-4 w-4 mr-2" />
                <span className="font-medium mr-2">Full Name:</span>
                <span>{supporter.full_name}</span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Mail className="h-4 w-4 mr-2" />
                <span className="font-medium mr-2">Email:</span>
                <span>{supporter.email}</span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="h-4 w-4 mr-2" />
                <span className="font-medium mr-2">Joined:</span>
                <span>{new Date(supporter.created_at).toLocaleString()}</span>
              </div>
              {supporter.last_login && (
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-2" />
                  <span className="font-medium mr-2">Last Login:</span>
                  <span>{new Date(supporter.last_login).toLocaleString()}</span>
                </div>
              )}
              <div className="flex items-center text-sm text-gray-500">
                <span className="font-medium mr-2">Supporter ID:</span>
                <code className="bg-gray-100 px-2 py-1 rounded">{supporter.id}</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Ticket Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{metrics.total}</div>
                    <div className="text-sm text-gray-500">Total Tickets</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{metrics.active}</div>
                    <div className="text-sm text-gray-500">Active Tickets</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Priority</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-600">Urgent</span>
                    <span className="text-sm font-medium">{metrics.byPriority.urgent}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-orange-600">High</span>
                    <span className="text-sm font-medium">{metrics.byPriority.high}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-yellow-600">Medium</span>
                    <span className="text-sm font-medium">{metrics.byPriority.medium}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-600">Low</span>
                    <span className="text-sm font-medium">{metrics.byPriority.low}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Unset</span>
                    <span className="text-sm font-medium">{metrics.byPriority.unset}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-600">New</span>
                    <span className="text-sm font-medium">{metrics.byStatus.new}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-yellow-600">In Progress</span>
                    <span className="text-sm font-medium">{metrics.byStatus.in_progress}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-600">Requires Response</span>
                    <span className="text-sm font-medium">{metrics.byStatus.requires_response}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-600">Closed</span>
                    <span className="text-sm font-medium">{metrics.byStatus.closed}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Tickets ({tickets.length})</CardTitle>
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
                            <Link 
                              href={`/customer/${ticket.created_by_user.id}`}
                              className="hover:text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ticket.created_by_user.full_name}
                            </Link>
                            <span>•</span>
                            <Link
                              href={`/account/${ticket.created_by_user.company?.id}`}
                              className="hover:text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {ticket.created_by_user.company?.company_name || 'No Company'}
                            </Link>
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

        <TabsContent value="reviews">
          <div className="space-y-6">
            {stats && (
              <Card>
                <CardHeader>
                  <CardTitle>Overall Rating</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-8 w-8 ${
                            star <= stats.average_rating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="text-lg">
                      <span className="font-medium">{stats.average_rating}</span>
                      <span className="text-gray-500 ml-1">
                        ({stats.total_ratings} {stats.total_ratings === 1 ? 'rating' : 'ratings'})
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Customer Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ratings.length === 0 ? (
                    <p className="text-gray-500">No reviews yet.</p>
                  ) : (
                    ratings.map((rating) => (
                      <div key={rating.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-5 w-5 ${
                                  star <= rating.rating
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(rating.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {rating.review && (
                          <p className="text-gray-600 mb-3">"{rating.review}"</p>
                        )}
                        <Link
                          href={`/tickets/${rating.ticket.id}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View Ticket: {rating.ticket.title}
                        </Link>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
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