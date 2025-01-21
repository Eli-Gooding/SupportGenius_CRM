import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"

interface RouteCaseDialogProps {
  ticketId: string
  onRouteComplete: () => void
}

export function RouteCaseDialog({ ticketId, onRouteComplete }: RouteCaseDialogProps) {
  const [selectedQueue, setSelectedQueue] = useState<string>("")
  const [selectedSupporter, setSelectedSupporter] = useState<string>("")
  const [queues, setQueues] = useState<Array<{ id: string; category_name: string }>>([])
  const [supporters, setSupporters] = useState<Array<{ id: string; full_name: string }>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  // Fetch queues and supporters when dialog opens
  const handleDialogOpen = async (open: boolean) => {
    setIsOpen(open)
    if (open) {
      try {
        // Fetch categories (queues)
        const { data: queueData, error: queueError } = await supabase
          .from('categories')
          .select('id, category_name')
          .order('category_name')

        if (queueError) throw queueError
        setQueues(queueData || [])

        // Fetch supporters
        const { data: supporterData, error: supporterError } = await supabase
          .from('supporters')
          .select('id, full_name')
          .order('full_name')

        if (supporterError) throw supporterError
        setSupporters(supporterData || [])
      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: "Error",
          description: "Failed to load queues and supporters. Please try again.",
          variant: "destructive",
        })
      }
    } else {
      // Reset form when dialog closes
      setSelectedQueue("")
      setSelectedSupporter("")
    }
  }

  const handleRoute = async () => {
    try {
      setIsLoading(true)
      console.log('Starting ticket update for ticket:', ticketId)

      // Get current ticket status
      const { data: currentTicket, error: ticketError } = await supabase
        .from('tickets')
        .select('ticket_status')
        .eq('id', ticketId)
        .single()

      if (ticketError) {
        console.error('Error fetching current ticket:', ticketError)
        throw ticketError
      }

      if (!currentTicket) {
        throw new Error('Ticket not found')
      }

      console.log('Current ticket status:', currentTicket.ticket_status)

      // Get current user for history entry
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('No authenticated user')

      // First, update the ticket
      const { data: updatedTicket, error: updateError } = await supabase
        .from('tickets')
        .update({
          category_id: selectedQueue,
          assigned_to_supporter_id: selectedSupporter,
          ticket_status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating ticket:', updateError)
        throw updateError
      }

      if (!updatedTicket) {
        throw new Error('Failed to update ticket')
      }

      console.log('Ticket updated successfully:', updatedTicket)

      // Then, create a status history entry
      const { error: historyError } = await supabase
        .from('ticket_status_history')
        .insert({
          ticket_id: ticketId,
          old_ticket_status: currentTicket.ticket_status,
          new_ticket_status: 'in_progress',
          changed_by_id: user.id
        })

      if (historyError) {
        console.error('Error creating status history:', historyError)
        // Don't throw here as the main update succeeded
      }

      toast({
        title: "Success",
        description: "Case has been routed successfully.",
      })

      setIsOpen(false)
      onRouteComplete()
    } catch (error) {
      console.error('Error routing case:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to route the case. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpen}>
      <DialogTrigger asChild>
        <Button>Route Case</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Route Case</DialogTitle>
          <DialogDescription>
            Select a queue and supporter to route this case to.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Select
              value={selectedQueue}
              onValueChange={setSelectedQueue}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select queue" />
              </SelectTrigger>
              <SelectContent>
                {queues.map((queue) => (
                  <SelectItem key={queue.id} value={queue.id}>
                    {queue.category_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Select
              value={selectedSupporter}
              onValueChange={setSelectedSupporter}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supporter" />
              </SelectTrigger>
              <SelectContent>
                {supporters.map((supporter) => (
                  <SelectItem key={supporter.id} value={supporter.id}>
                    {supporter.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleRoute}
            disabled={!selectedQueue || !selectedSupporter || isLoading}
          >
            {isLoading ? "Routing..." : "Route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 