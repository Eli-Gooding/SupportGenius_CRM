"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Check, X } from "lucide-react"

interface UserProfile {
  id: string
  email: string
  full_name: string
  license_id: string
}

interface License {
  id: string
  license_name: string
  license_cost: number
  license_ranking: number
}

interface LicenseFeature {
  id: string
  license_id: string
  feature_name: string
  feature_description: string
}

interface LicenseRequest {
  id: string
  request_status: 'pending' | 'approved' | 'rejected'
  requested_license_id: string
  created_at: string
}

export default function AccountSettings() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [licenses, setLicenses] = useState<License[]>([])
  const [licenseFeatures, setLicenseFeatures] = useState<LicenseFeature[]>([])
  const [currentRequest, setCurrentRequest] = useState<LicenseRequest | null>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [editedName, setEditedName] = useState("")
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const { toast } = useToast()

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (error) throw error
      setProfile(profile)
      setEditedName(profile.full_name || '')
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast({
        title: "Error",
        description: "Failed to load profile. Please try again later.",
        variant: "destructive",
      })
    }
  }

  const fetchLicenses = async () => {
    try {
      const { data: licenses, error } = await supabase
        .from('licenses')
        .select('*')
        .order('license_ranking')

      if (error) throw error
      setLicenses(licenses)
    } catch (error) {
      console.error('Error fetching licenses:', error)
    }
  }

  const fetchLicenseFeatures = async () => {
    try {
      const { data: features, error } = await supabase
        .from('license_features')
        .select('*')

      if (error) throw error
      setLicenseFeatures(features)
    } catch (error) {
      console.error('Error fetching license features:', error)
    }
  }

  const fetchCurrentRequest = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: request, error } = await supabase
        .from('license_update_requests')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('request_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 is "no rows returned"
      setCurrentRequest(request)
    } catch (error) {
      console.error('Error fetching current request:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([
      fetchProfile(),
      fetchLicenses(),
      fetchLicenseFeatures(),
      fetchCurrentRequest()
    ])
  }, [])

  const handleUpdateProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        toast({
          title: "Error",
          description: "You must be logged in to update your profile.",
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase
        .from('users')
        .update({ full_name: editedName })
        .eq('id', session.user.id)

      if (error) throw error

      setProfile(prev => prev ? { ...prev, full_name: editedName } : null)
      setIsEditingProfile(false)
      toast({
        title: "Success",
        description: "Profile updated successfully.",
      })
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleLicenseRequest = async (requestedLicenseId: string) => {
    try {
      const { error } = await supabase
        .from('license_update_requests')
        .insert([{
          user_id: profile?.id,
          current_license_id: profile?.license_id,
          requested_license_id: requestedLicenseId,
          request_status: 'pending'
        }])

      if (error) throw error

      setIsUpgradeDialogOpen(false)
      await fetchCurrentRequest()
      toast({
        title: "Success",
        description: "License upgrade request submitted successfully.",
      })
    } catch (error) {
      console.error('Error submitting license request:', error)
      toast({
        title: "Error",
        description: "Failed to submit license request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getCurrentLicense = () => {
    return licenses.find(l => l.id === profile?.license_id)
  }

  const getLicenseFeatures = (licenseId: string) => {
    return licenseFeatures.filter(f => f.license_id === licenseId)
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-semibold text-gray-900 mb-6">Account Settings</h1>
        
        <div className="space-y-6">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <Input value={profile?.email || ''} disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <div className="flex space-x-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      disabled={!isEditingProfile}
                    />
                    {isEditingProfile ? (
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditedName(profile?.full_name || '')
                            setIsEditingProfile(false)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          onClick={handleUpdateProfile}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => setIsEditingProfile(true)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* License Section */}
          <Card>
            <CardHeader>
              <CardTitle>License Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Current License</p>
                  <p className="text-lg font-semibold">{getCurrentLicense()?.license_name}</p>
                </div>

                {currentRequest ? (
                  <div className="bg-blue-50 p-4 rounded-md">
                    <p className="text-sm text-blue-700">
                      You have a pending request to upgrade to {
                        licenses.find(l => l.id === currentRequest.requested_license_id)?.license_name
                      }
                    </p>
                  </div>
                ) : (
                  <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>Request License Upgrade</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Compare License Tiers</DialogTitle>
                      </DialogHeader>
                      <div className="grid grid-cols-3 gap-4">
                        {licenses.map((license) => (
                          <Card key={license.id}>
                            <CardHeader>
                              <CardTitle>{license.license_name}</CardTitle>
                              <p className="text-2xl font-bold">${license.license_cost}</p>
                            </CardHeader>
                            <CardContent>
                              <ul className="space-y-2">
                                {getLicenseFeatures(license.id).map((feature) => (
                                  <li key={feature.id} className="flex items-start">
                                    <Check className="h-5 w-5 text-green-500 mr-2" />
                                    <div>
                                      <p className="font-medium">{feature.feature_name}</p>
                                      <p className="text-sm text-gray-500">{feature.feature_description}</p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              {license.license_ranking > (getCurrentLicense()?.license_ranking || 0) && (
                                <Button
                                  className="w-full mt-4"
                                  onClick={() => handleLicenseRequest(license.id)}
                                >
                                  Request Upgrade
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 