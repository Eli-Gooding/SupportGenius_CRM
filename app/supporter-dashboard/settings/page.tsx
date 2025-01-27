"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface Supporter {
  id: string
  full_name: string
  email: string
  is_admin: boolean
}

export default function SupporterSettings() {
  const [supporter, setSupporter] = useState<Supporter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const fetchSupporter = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: supporter, error } = await supabase
          .from('supporters')
          .select('id, full_name, email, is_admin')
          .eq('id', user.id)
          .single()

        if (error) throw error
        setSupporter(supporter)
      } catch (error) {
        console.error('Error fetching supporter:', error)
        toast({
          title: "Error",
          description: "Failed to load supporter information",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchSupporter()
  }, [])

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!supporter) return

    try {
      setIsSaving(true)
      const formData = new FormData(e.currentTarget)
      const updates = {
        full_name: formData.get('full_name') as string,
      }

      const { error } = await supabase
        .from('supporters')
        .update(updates)
        .eq('id', supporter.id)

      if (error) throw error

      setSupporter(prev => prev ? { ...prev, ...updates } : null)
      toast({
        title: "Success",
        description: "Profile updated successfully",
      })
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (!supporter) {
    return <div className="flex justify-center items-center h-screen">Not authorized</div>
  }

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col space-y-6">
          <h1 className="text-3xl font-semibold text-gray-900">Account Settings</h1>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={supporter.email}
                    disabled
                  />
                </div>

                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    defaultValue={supporter.full_name}
                    required
                  />
                </div>

                <div>
                  <Label>Role</Label>
                  <Input
                    value={supporter.is_admin ? "Internal (Admin)" : "Internal"}
                    disabled
                  />
                </div>

                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 