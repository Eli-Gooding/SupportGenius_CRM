"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import { User, Building2, AlertCircle, Calendar, Clock, Copy, Check, Star } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { GlobalSearch } from "@/components/global-search"
import { ResponseTemplates } from "@/components/response-templates"

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

interface Note {
  id: string
  note_title: string
  content: string
  created_at: string
  supporter: {
    id: string
    full_name: string
  }
}

interface FileRecord {
  id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  created_at: string
  uploaded_by_type: 'user' | 'supporter'
  uploaded_by_id: string
}

interface UserRecord {
  id: string
  full_name: string
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
  category_id: string | null
  category: {
    id: string
    category_name: string
  } | null
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
  supporter_rating: SupporterRating | null
}

export default function TicketDetails({ params }: { params: { id: string } }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [files, setFiles] = useState<TicketFile[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [newNote, setNewNote] = useState({ title: "", content: "" })
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState("messages")
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [isCopied, setIsCopied] = useState(false)

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

  const fetchNotes = async () => {
    try {
      const { data: notes, error } = await supabase
        .from('notes')
        .select(`
          *,
          supporter:supporters(id, full_name)
        `)
        .eq('ticket_id', params.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setNotes(notes)
    } catch (error) {
      console.error('Error fetching notes:', error)
      toast({
        title: "Error",
        description: "Failed to load notes. Please try refreshing the page.",
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

      const fileRecords = files as FileRecord[]

      // Get unique uploader IDs grouped by type
      const supporterIds = [...new Set(fileRecords.filter(f => f.uploaded_by_type === 'supporter').map(f => f.uploaded_by_id))]
      const userIds = [...new Set(fileRecords.filter(f => f.uploaded_by_type === 'user').map(f => f.uploaded_by_id))]

      // Fetch supporters if needed
      let supporterMap = new Map<string, UserRecord>()
      if (supporterIds.length > 0) {
        const { data: supporters, error: supportersError } = await supabase
          .from('supporters')
          .select('id, full_name')
          .in('id', supporterIds)

        if (supportersError) throw supportersError
        supporterMap = new Map((supporters as UserRecord[])?.map(s => [s.id, s]))
      }

      // Fetch users if needed
      let userMap = new Map<string, UserRecord>()
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', userIds)

        if (usersError) throw usersError
        userMap = new Map((users as UserRecord[])?.map(u => [u.id, u]))
      }

      // Transform the data to match our TicketFile interface
      const transformedFiles: TicketFile[] = fileRecords.map(file => ({
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
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            category:categories (
              id,
              category_name
            ),
            created_by_user:users (
              id,
              full_name,
              company:companies (
                id,
                company_name
              )
            ),
            assigned_to_supporter:supporters (
              id,
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

        // Fetch rating separately to ensure we get the correct data
        const { data: ratingData, error: ratingError } = await supabase
          .from('supporter_ratings')
          .select('*')
          .eq('ticket_id', params.id)
          .single()

        if (ratingError && ratingError.code !== 'PGRST116') { // Ignore "no rows returned" error
          throw ratingError
        }

        // Transform the data to match our interfaces
        const transformedTicket: Ticket = {
          id: ticketData.id,
          title: ticketData.title,
          ticket_status: ticketData.ticket_status,
          priority: ticketData.priority,
          created_at: ticketData.created_at,
          updated_at: ticketData.updated_at,
          category_id: ticketData.category_id,
          category: ticketData.category || null,
          created_by_user: ticketData.created_by_user 
            ? {
                id: ticketData.created_by_user.id,
                full_name: ticketData.created_by_user.full_name,
                company: ticketData.created_by_user.company || null
              }
            : null,
          assigned_to_supporter: ticketData.assigned_to_supporter || null,
          supporter_rating: ratingData 
            ? {
                id: ratingData.id,
                rating: ratingData.rating,
                review: ratingData.review,
                created_at: ratingData.created_at
              }
            : null
        }

        setTicket(transformedTicket)
        await Promise.all([
          fetchMessages(),
          fetchNotes(),
          fetchFiles()
        ])
      } catch (error) {
        console.error('Error fetching data:', error)
        router.push("/supporter-dashboard")
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

  const updateTicketStatus = async (newStatus: Ticket['ticket_status']) => {
    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ ticket_status: newStatus })
        .eq('id', params.id)

      if (error) throw error

      setTicket((prev): Ticket | null => 
        prev ? { ...prev, ticket_status: newStatus } : null
      )
      toast({
        title: "Status updated",
        description: `Ticket status has been updated to ${newStatus.replace('_', ' ')}.`,
      })
    } catch (error) {
      console.error('Error updating ticket status:', error)
      toast({
        title: "Error",
        description: "Failed to update ticket status.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const updateTicketPriority = async (newPriority: NonNullable<Ticket['priority']>) => {
    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority: newPriority })
        .eq('id', params.id)

      if (error) throw error

      setTicket((prev): Ticket | null => 
        prev ? { ...prev, priority: newPriority } : null
      )
      toast({
        title: "Priority updated",
        description: `Ticket priority has been updated to ${newPriority}.`,
      })
    } catch (error) {
      console.error('Error updating ticket priority:', error)
      toast({
        title: "Error",
        description: "Failed to update ticket priority.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNote.content.trim()) return

    setIsSending(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError

      const { error: noteError } = await supabase
        .from('notes')
        .insert({
          ticket_id: params.id,
          supporter_id: userData.user.id,
          note_title: newNote.title.trim() || null,
          content: newNote.content.trim(),
        })

      if (noteError) throw noteError

      setNewNote({ title: "", content: "" })
      await fetchNotes()
      toast({
        title: "Note added",
        description: "Your note has been added successfully.",
      })
    } catch (error) {
      console.error('Error adding note:', error)
      toast({
        title: "Error",
        description: "Failed to add note. Please try again.",
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
          uploaded_by_type: 'supporter',
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
          <Button variant="outline" onClick={() => router.push("/supporter-dashboard")}>
            Back to Dashboard
          </Button>
        </div>
        <GlobalSearch />
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
                  <Link 
                    href={`/customer/${ticket.created_by_user?.id}`}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {ticket.created_by_user?.full_name || 'Unknown'}
                  </Link>
                </div>
                <div className="flex items-center">
                  <Building2 className="h-4 w-4 mr-1" />
                  <Link 
                    href={`/account/${ticket.created_by_user?.company?.id}`}
                    className="hover:text-blue-600 hover:underline"
                  >
                    {ticket.created_by_user?.company?.company_name || 'Unknown'}
                  </Link>
                </div>
              </div>
              <div className="flex flex-col space-y-2 mt-2 text-sm text-gray-500">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center">
                    <span className="font-medium mr-1">Queue:</span>
                    <span>{ticket.category?.category_name || 'Uncategorized'}</span>
                  </div>
                </div>
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
              <DropdownMenu>
                <DropdownMenuTrigger disabled={isUpdating} asChild>
                  <button
                    className={`mt-1 text-sm px-2 py-1 rounded hover:bg-gray-100 ${
                      ticket.ticket_status === 'new' ? 'text-blue-600' :
                      ticket.ticket_status === 'in_progress' ? 'text-yellow-600' :
                      ticket.ticket_status === 'requires_response' ? 'text-red-600' :
                      'text-green-600'
                    }`}
                  >
                    {ticket.ticket_status.replace('_', ' ').toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => updateTicketStatus('new')}>
                    NEW
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateTicketStatus('in_progress')}>
                    IN PROGRESS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateTicketStatus('requires_response')}>
                    REQUIRES RESPONSE
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateTicketStatus('closed')}>
                    CLOSED
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="text-sm font-medium text-gray-900 mt-2">Priority</div>
              <DropdownMenu>
                <DropdownMenuTrigger disabled={isUpdating} asChild>
                  <button
                    className={`mt-1 text-sm px-2 py-1 rounded hover:bg-gray-100 ${
                      ticket.priority === 'urgent' ? 'text-red-600' :
                      ticket.priority === 'high' ? 'text-orange-600' :
                      ticket.priority === 'medium' ? 'text-yellow-600' :
                      ticket.priority === 'low' ? 'text-green-600' :
                      'text-gray-600'
                    }`}
                  >
                    {ticket.priority ? ticket.priority.toUpperCase() : 'NOT SET'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => updateTicketPriority('urgent')}>
                    URGENT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateTicketPriority('high')}>
                    HIGH
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateTicketPriority('medium')}>
                    MEDIUM
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateTicketPriority('low')}>
                    LOW
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {ticket.assigned_to_supporter && (
                <div className="mt-2">
                  <div className="text-sm font-medium text-gray-900">Assigned To</div>
                  <Link
                    href={`/supporter/${ticket.assigned_to_supporter.id}`}
                    className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
                  >
                    {ticket.assigned_to_supporter.full_name}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {ticket.ticket_status === 'closed' && ticket.supporter_rating && (
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <h3 className="text-lg font-medium mb-2">Customer Rating</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-6 w-6 ${
                        star <= ticket.supporter_rating!.rating
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                {ticket.supporter_rating.review && (
                  <p className="text-gray-600 italic">"{ticket.supporter_rating.review}"</p>
                )}
                <p className="text-sm text-gray-500">
                  Submitted on {new Date(ticket.supporter_rating.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
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
                  {ticket.ticket_status === 'closed' && (
                    <p className="text-sm text-gray-500 mt-2">
                      This ticket is closed. No new messages can be sent.
                    </p>
                  )}
                </div>
              </form>

              <ResponseTemplates 
                categoryId={ticket.category_id} 
                onSelectTemplate={(content) => setNewMessage(content)}
              />
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-4">
                  {notes.length === 0 ? (
                    <p className="text-sm text-gray-500">No notes yet.</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium">{note.note_title || 'Untitled Note'}</h4>
                          <span className="text-xs text-gray-500">
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Added by {note.supporter.full_name}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <form onSubmit={handleAddNote} className="space-y-4">
                <div>
                  <Label htmlFor="note-title">Note Title (Optional)</Label>
                  <Input
                    id="note-title"
                    value={newNote.title}
                    onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter note title..."
                    className="mt-1"
                    disabled={isSending}
                  />
                </div>
                <div>
                  <Label htmlFor="note-content">Note Content</Label>
                  <Textarea
                    id="note-content"
                    value={newNote.content}
                    onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Type your note here..."
                    className="mt-1"
                    disabled={isSending}
                  />
                </div>
                <Button type="submit" disabled={isSending || !newNote.content.trim()}>
                  {isSending ? "Adding..." : "Add Note"}
                </Button>
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
                    disabled={isSending}
                    className="flex-grow"
                  />
                  <Button 
                    onClick={handleFileUpload}
                    disabled={isSending || !selectedFile}
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

