"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import { User, Building2, Calendar, Clock, Copy, Check, Star, StarOff } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

interface TicketFile {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  created_at: string
  uploaded_by_type: 'user' | 'supporter'
  uploaded_by: {
    id: string
    full_name: string
  }
}

interface SupporterRating {
  id: string
  rating: number
  review: string | null
  created_at: string
}

interface Ticket {
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
  } | null
  assigned_to_supporter: {
    id: string
    full_name: string
  } | null
  supporter_rating: SupporterRating[] | null
}

export default function CustomerTicketDetails({ params }: { params: { id: string } }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [files, setFiles] = useState<TicketFile[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState("messages")
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [isCopied, setIsCopied] = useState(false)
  const [rating, setRating] = useState<number>(0)
  const [review, setReview] = useState("")
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [hoveredRating, setHoveredRating] = useState<number>(0)

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

  const fetchFiles = async () => {
    try {
      // First get all files
      const { data: files, error } = await supabase
        .from('files')
        .select(`
          id,
          file_name,
          file_size,
          mime_type,
          storage_path,
          created_at,
          uploaded_by_type,
          uploaded_by_id
        `)
        .eq('ticket_id', params.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get unique uploader IDs grouped by type
      const supporterIds = [...new Set(files.filter(f => f.uploaded_by_type === 'supporter').map(f => f.uploaded_by_id))]
      const userIds = [...new Set(files.filter(f => f.uploaded_by_type === 'user').map(f => f.uploaded_by_id))]

      // Fetch supporters
      let supporterMap = new Map<string, { id: string, full_name: string }>()
      if (supporterIds.length > 0) {
        const { data: supporters, error: supportersError } = await supabase
          .from('supporters')
          .select('id, full_name')
          .in('id', supporterIds)

        if (supportersError) throw supportersError
        supporterMap = new Map(supporters?.map(s => [s.id, s]))
      }

      // Fetch users
      let userMap = new Map<string, { id: string, full_name: string }>()
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds)

        if (usersError) throw usersError
        userMap = new Map(users?.map(u => [u.id, u]))
      }

      // Transform the data
      const transformedFiles = files.map(file => ({
        id: file.id,
        file_name: file.file_name,
        file_size: file.file_size,
        mime_type: file.mime_type,
        storage_path: file.storage_path,
        created_at: file.created_at,
        uploaded_by_type: file.uploaded_by_type,
        uploaded_by: file.uploaded_by_type === 'supporter'
          ? supporterMap.get(file.uploaded_by_id) || { id: file.uploaded_by_id, full_name: 'Unknown' }
          : userMap.get(file.uploaded_by_id) || { id: file.uploaded_by_id, full_name: 'Unknown' }
      }))

      setFiles(transformedFiles)
    } catch (error) {
      console.error('Error fetching files:', error)
      toast({
        title: "Error",
        description: "Failed to load files. Please try refreshing the page.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch ticket data
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            created_by_user: users!created_by_user_id (
              id,
              full_name,
              company: companies!company_id (
                id,
                company_name
              )
            ),
            assigned_to_supporter: supporters!assigned_to_supporter_id (
              id,
              full_name
            ),
            supporter_rating: supporter_ratings!inner (
              id,
              rating,
              review,
              created_at
            )
          `)
          .eq('id', params.id)
          .single()

        if (ticketError) throw ticketError
        if (!ticketData) {
          router.push("/customer-dashboard")
          return
        }

        // Transform the supporter_rating data to match our interface
        const transformedTicket = {
          ...ticketData,
          supporter_rating: ticketData.supporter_rating ? [ticketData.supporter_rating] : null
        }

        // If there's an existing rating, set it
        if (transformedTicket.supporter_rating && transformedTicket.supporter_rating.length > 0) {
          setRating(transformedTicket.supporter_rating[0].rating)
          setReview(transformedTicket.supporter_rating[0].review || '')
        }

        setTicket(transformedTicket as Ticket)
        await Promise.all([
          fetchMessages(),
          fetchFiles()
        ])
      } catch (error) {
        console.error('Error fetching data:', error)
        router.push("/customer-dashboard")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
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
          sender_type: 'user',
          sender_id: userData.user.id,
        })

      if (messageError) throw messageError

      setNewMessage("")
      await fetchMessages()
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleFileUpload = async () => {
    if (!selectedFile) return

    setIsSending(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${params.id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('ticket-files')
        .upload(fileName, selectedFile, {
          contentType: selectedFile.type
        })

      if (uploadError) throw uploadError

      // Create file record
      const { error: fileError } = await supabase
        .from('files')
        .insert({
          ticket_id: params.id,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          mime_type: selectedFile.type,
          storage_path: fileName,
          uploaded_by_type: 'user',
          uploaded_by_id: userData.user.id,
        })

      if (fileError) throw fileError

      await fetchFiles()
      setSelectedFile(null)
      // Clear the file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''
      
      toast({
        title: "File uploaded",
        description: "Your file has been uploaded successfully.",
      })
    } catch (error) {
      console.error('Error uploading file:', error)
      toast({
        title: "Error",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleFileDownload = async (file: TicketFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('ticket-files')
        .download(file.storage_path)

      if (error) throw error

      // Create a blob URL and trigger download
      const blob = new Blob([data], { type: file.mime_type })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.file_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: "File download started.",
      })
    } catch (error) {
      console.error('Error downloading file:', error)
      toast({
        title: "Error",
        description: "Failed to download file. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCopyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
    toast({
      title: "Link copied",
      description: "Ticket link has been copied to clipboard",
    })
  }

  const handleRatingSubmit = async () => {
    if (!ticket?.assigned_to_supporter?.id || rating === 0) return

    setIsSubmittingRating(true)
    try {
      const { error } = await supabase
        .from('supporter_ratings')
        .insert({
          ticket_id: params.id,
          supporter_id: ticket.assigned_to_supporter.id,
          rating,
          review: review.trim() || null,
          created_by_user_id: ticket.created_by_user?.id
        })

      if (error) throw error

      toast({
        title: "Rating submitted",
        description: "Thank you for your feedback!",
      })

      // Update local state to reflect the new rating
      setTicket(prev => {
        if (!prev) return prev
        return {
          ...prev,
          supporter_rating: [{
            id: 'temp-id',
            rating,
            review: review.trim() || null,
            created_at: new Date().toISOString()
          }]
        } as Ticket
      })
    } catch (error) {
      console.error('Error submitting rating:', error)
      toast({
        title: "Error",
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingRating(false)
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
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push("/customer-dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-2xl">{ticket.title}</CardTitle>
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
              <div className="flex items-center space-x-6 text-sm text-gray-500">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  <span>{ticket.created_by_user?.full_name || 'Unknown'}</span>
                </div>
                <div className="flex items-center">
                  <Building2 className="h-4 w-4 mr-1" />
                  <span>{ticket.created_by_user?.company?.company_name || 'Unknown'}</span>
                </div>
              </div>
              <div className="flex flex-col space-y-2 mt-2 text-sm text-gray-500">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                    <span className="font-medium mr-1">ID:</span>
                    <code className="px-2 py-1 bg-gray-100 rounded text-sm">{params.id}</code>
                  </div>
                </div>
                <div className="flex items-center space-x-6">
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
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">Status</div>
              <div className="mt-1">
                <span
                  className={`text-sm px-2 py-1 rounded ${
                    ticket.ticket_status === 'new' ? 'bg-blue-100 text-blue-800' :
                    ticket.ticket_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                    ticket.ticket_status === 'requires_response' ? 'bg-red-100 text-red-800' :
                    'bg-green-100 text-green-800'
                  }`}
                >
                  {ticket.ticket_status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {ticket.priority && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-gray-900">Priority</div>
                  <div className="mt-1">
                    <span
                      className={`text-sm px-2 py-1 rounded ${
                        ticket.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}
                    >
                      {ticket.priority.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              {ticket.assigned_to_supporter && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-gray-900">Support Agent</div>
                  <div className="text-sm text-gray-500">
                    {ticket.assigned_to_supporter.full_name}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ticket?.ticket_status === 'closed' && ticket.assigned_to_supporter && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium mb-2">Rate Your Support Experience</h3>
              {ticket.supporter_rating && ticket.supporter_rating.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-6 w-6 ${
                          star <= ticket.supporter_rating![0].rating
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  {ticket.supporter_rating[0].review && (
                    <p className="text-gray-600 italic">"{ticket.supporter_rating[0].review}"</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Submitted on {new Date(ticket.supporter_rating[0].created_at).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Rating</Label>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="focus:outline-none"
                        >
                          {star <= (hoveredRating || rating) ? (
                            <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                          ) : (
                            <StarOff className="h-6 w-6 text-gray-300" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="review">Review (Optional)</Label>
                    <Input
                      id="review"
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      placeholder="Share your experience with the support team..."
                      className="mt-1"
                    />
                  </div>
                  <Button
                    onClick={handleRatingSubmit}
                    disabled={isSubmittingRating || rating === 0}
                  >
                    {isSubmittingRating ? "Submitting..." : "Submit Rating"}
                  </Button>
                </div>
              )}
            </div>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="space-y-4">
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <p className="text-sm text-gray-500">No messages yet.</p>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex flex-col ${
                          message.sender_type === 'supporter' ? 'items-start' : 'items-end'
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
                      disabled={isSending || ticket.ticket_status === 'closed'}
                    />
                    <Button 
                      type="submit" 
                      className="ml-2" 
                      disabled={isSending || !newMessage.trim() || ticket.ticket_status === 'closed'}
                    >
                      {isSending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              <div className="mb-4">
                <Label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
                  Upload New File
                </Label>
                <div className="mt-1 flex items-center space-x-2">
                  <Input
                    id="file-upload"
                    type="file"
                    onChange={handleFileSelect}
                    disabled={isSending || ticket.ticket_status === 'closed'}
                    className="flex-grow"
                  />
                  <Button 
                    onClick={handleFileUpload}
                    disabled={isSending || !selectedFile || ticket.ticket_status === 'closed'}
                  >
                    {isSending ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="space-y-2">
                  {files.length === 0 ? (
                    <p className="text-sm text-gray-500">No files uploaded yet.</p>
                  ) : (
                    files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.file_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(file.created_at).toLocaleString()} • 
                            {(file.file_size / 1024).toFixed(2)} KB • 
                            Uploaded by {file.uploaded_by.full_name}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-4"
                          onClick={() => handleFileDownload(file)}
                        >
                          Download
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
} 