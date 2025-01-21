"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Sample ticket data (in a real app, this would come from an API)
const tickets = [
  {
    id: 1,
    title: "Cannot access account",
    status: "Open",
    createdAt: "2023-05-01",
    description: "User reported inability to log in to their account.",
  },
  {
    id: 2,
    title: "Feature request: Dark mode",
    status: "Closed",
    createdAt: "2023-04-28",
    description: "Multiple users have requested a dark mode option for the application.",
  },
  {
    id: 3,
    title: "Bug in reporting module",
    status: "Open",
    createdAt: "2023-04-30",
    description: "Reports are not generating correctly for Q2 data.",
  },
  // ... add more sample tickets as needed
]

export default function TicketDetails({ params }: { params: { id: string } }) {
  const [ticket, setTicket] = useState<(typeof tickets)[0] | null>(null)
  const [newMessage, setNewMessage] = useState("")
  const router = useRouter()

  useEffect(() => {
    const fetchedTicket = tickets.find((t) => t.id === Number.parseInt(params.id))
    if (fetchedTicket) {
      setTicket(fetchedTicket)
    } else {
      // Redirect to 404 or dashboard if ticket not found
      router.push("/dashboard")
    }
  }, [params.id, router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would typically send the new message to your backend
    console.log("New message:", newMessage)
    setNewMessage("")
  }

  if (!ticket) {
    return <div>Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Ticket #{ticket.id}: {ticket.title}
          </CardTitle>
          <p className="text-sm text-gray-500">Status: {ticket.status}</p>
          <p className="text-sm text-gray-500">Created: {ticket.createdAt}</p>
        </CardHeader>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2">Description</h3>
          <p className="mb-4">{ticket.description}</p>

          <h3 className="text-lg font-semibold mb-2">Messages</h3>
          {/* Here you would map through and display messages */}
          <p className="text-sm text-gray-500 mb-4">No messages yet.</p>

          <form onSubmit={handleSubmit}>
            <Label htmlFor="new-message">New Message</Label>
            <div className="flex mt-2">
              <Input
                id="new-message"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message here..."
                className="flex-grow"
              />
              <Button type="submit" className="ml-2">
                Send
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="mt-4">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}

