"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface DatabaseLicenseRequest {
  id: string
  user_id: string
  current_license_id: string
  requested_license_id: string
  request_status: 'pending' | 'approved' | 'rejected'
  created_at: string
  user: {
    full_name: string
    email: string
    company: {
      company_name: string
    }
  }
  current_license: {
    license_name: string
    license_cost: number
  }
  requested_license: {
    license_name: string
    license_cost: number
  }
}

interface License {
  id: string
  license_name: string
  license_cost: number
  _count: {
    users: number
  }
}

interface SupporterCaseload {
  supporter_name: string
  active_cases: number
}

interface QueueCaseload {
  queue_name: string
  active_cases: number
}

interface UserCount {
  license_id: string
  count: number
}

interface SupporterStat {
  assigned_to_supporter: {
    id: string
    full_name: string
  } | null
  count: number
}

interface QueueStat {
  category: {
    id: string
    category_name: string
  } | null
  count: number
}

export default function AdminDashboard() {
  const [licenseRequests, setLicenseRequests] = useState<DatabaseLicenseRequest[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [supporterCaseloads, setSupporterCaseloads] = useState<SupporterCaseload[]>([])
  const [queueCaseloads, setQueueCaseloads] = useState<QueueCaseload[]>([])
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '1y'>('30d')
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        // Fetch supporter info to verify admin status
        const { data: supporter } = await supabase
          .from('supporters')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        if (!supporter?.is_admin) {
          router.push('/supporter-dashboard')
          return
        }

        // Fetch pending license requests
        const { data: requests, error: requestsError } = await supabase
          .from('license_update_requests')
          .select(`
            id,
            user_id,
            current_license_id,
            requested_license_id,
            request_status,
            created_at,
            user:user_id (
              full_name,
              email,
              company:company_id (
                company_name
              )
            ),
            current_license:current_license_id (
              license_name,
              license_cost
            ),
            requested_license:requested_license_id (
              license_name,
              license_cost
            )
          `)
          .eq('request_status', 'pending')
          .order('created_at', { ascending: false }) as { data: DatabaseLicenseRequest[] | null, error: any }

        if (requestsError) throw requestsError
        setLicenseRequests(requests || [])

        // Fetch license statistics
        const { data: licenseStats, error: licenseError } = await supabase
          .from('licenses')
          .select('id, license_name, license_cost')

        if (licenseError) throw licenseError

        // Count users per license
        const { data: userCounts, error: userCountError } = await supabase
          .rpc('get_license_user_counts') as { data: UserCount[] | null, error: any }

        if (userCountError) throw userCountError

        const licensesWithCounts = licenseStats.map(license => ({
          ...license,
          _count: {
            users: userCounts?.find(count => count.license_id === license.id)?.count || 0
          }
        }))

        setLicenses(licensesWithCounts)

        // Fetch supporter caseloads
        const { data: supporterStats, error: supporterError } = await supabase
          .rpc('get_supporter_caseloads') as { data: SupporterStat[] | null, error: any }

        if (supporterError) throw supporterError

        const supporterData: SupporterCaseload[] = (supporterStats || [])
          .filter((stat): stat is SupporterStat & { assigned_to_supporter: NonNullable<SupporterStat['assigned_to_supporter']> } => 
            stat.assigned_to_supporter !== null)
          .map(stat => ({
            supporter_name: stat.assigned_to_supporter.full_name,
            active_cases: Number(stat.count)
          }))

        setSupporterCaseloads(supporterData)

        // Fetch queue caseloads
        const { data: queueStats, error: queueError } = await supabase
          .rpc('get_queue_caseloads') as { data: QueueStat[] | null, error: any }

        if (queueError) throw queueError

        const queueData: QueueCaseload[] = (queueStats || [])
          .filter((stat): stat is QueueStat & { category: NonNullable<QueueStat['category']> } => 
            stat.category !== null)
          .map(stat => ({
            queue_name: stat.category.category_name,
            active_cases: Number(stat.count)
          }))

        setQueueCaseloads(queueData)

      } catch (error) {
        console.error('Error fetching admin data:', error)
        toast({
          title: "Error",
          description: "Failed to load admin dashboard data",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleLicenseRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const request = licenseRequests.find(r => r.id === requestId)
      if (!request) return

      const { error: updateError } = await supabase
        .from('license_update_requests')
        .update({
          request_status: status,
          processed_by_id: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId)

      if (updateError) throw updateError

      if (status === 'approved') {
        // Update user's license
        const { error: licenseError } = await supabase
          .from('users')
          .update({ license_id: request.requested_license_id })
          .eq('id', request.user_id)

        if (licenseError) throw licenseError
      }

      // Update local state
      setLicenseRequests(prev => prev.filter(r => r.id !== requestId))

      toast({
        title: "Success",
        description: `License request ${status}`,
      })
    } catch (error) {
      console.error('Error processing license request:', error)
      toast({
        title: "Error",
        description: "Failed to process license request",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-semibold text-gray-900">Admin Dashboard</h1>
            <Select value={timeRange} onValueChange={(value: '7d' | '30d' | '1y') => setTimeRange(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="licenses">License Requests</TabsTrigger>
              <TabsTrigger value="caseload">Caseload</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Subscription Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={licenses}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="license_name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="_count.users" name="Active Users" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={licenses}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="license_name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar
                            dataKey="license_cost"
                            name="Monthly Revenue per User"
                            fill="#10b981"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="licenses">
              <Card>
                <CardHeader>
                  <CardTitle>Pending License Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {licenseRequests.map((request) => (
                        <Card key={request.id}>
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="font-medium">{request.user.full_name}</h3>
                                <p className="text-sm text-gray-500">{request.user.company.company_name}</p>
                                <p className="text-sm text-gray-500">{request.user.email}</p>
                                <p className="text-sm mt-2">
                                  Requesting upgrade from{" "}
                                  <span className="font-medium">{request.current_license.license_name}</span> to{" "}
                                  <span className="font-medium">{request.requested_license.license_name}</span>
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => handleLicenseRequest(request.id, 'rejected')}
                                >
                                  Reject
                                </Button>
                                <Button
                                  onClick={() => handleLicenseRequest(request.id, 'approved')}
                                >
                                  Approve
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {licenseRequests.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No pending license requests</p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="caseload">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Supporter Caseload</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={supporterCaseloads}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="supporter_name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="active_cases" name="Active Cases" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Queue Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={queueCaseloads}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="queue_name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="active_cases" name="Active Cases" fill="#ec4899" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
} 