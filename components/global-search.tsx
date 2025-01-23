"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2, Search, Ticket, User, Loader2, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useToast } from "@/components/ui/use-toast"

interface SearchResult {
  id: string
  type: 'ticket' | 'customer' | 'supporter' | 'company'
  title: string
  subtitle?: string
}

interface TicketResult {
  id: string
  title: string
  created_by_user: {
    full_name: string
  } | null
}

interface CustomerResult {
  id: string
  full_name: string
  company: {
    company_name: string
  } | null
}

interface SupporterResult {
  id: string
  full_name: string
}

interface CompanyResult {
  id: string
  company_name: string
}

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // Reset states when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Clear the search state when closing
      setQuery("")
      setResults([])
      setIsLoading(false)
      // Cancel any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const performSearch = React.useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([])
      return
    }

    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController()

    setIsLoading(true)
    try {
      // Create the text search query
      const formattedQuery = searchQuery.trim().split(/\s+/).join(' & ')

      const [ticketsResponse, customersResponse, supportersResponse, companiesResponse] = await Promise.all([
        // Search tickets using full-text search
        supabase
          .from('tickets')
          .select(`
            id,
            title,
            created_by_user:users!created_by_user_id (
              full_name
            )
          `)
          .textSearch('search_vector', formattedQuery)
          .limit(5)
          .returns<TicketResult[]>(),

        // Search customers using full-text search
        supabase
          .from('users')
          .select(`
            id,
            full_name,
            company:companies!company_id (
              company_name
            )
          `)
          .textSearch('search_vector', formattedQuery)
          .limit(5)
          .returns<CustomerResult[]>(),

        // Search supporters using full-text search
        supabase
          .from('supporters')
          .select('id, full_name')
          .textSearch('search_vector', formattedQuery)
          .limit(5)
          .returns<SupporterResult[]>(),

        // Search companies using full-text search
        supabase
          .from('companies')
          .select('id, company_name')
          .textSearch('search_vector', formattedQuery)
          .limit(5)
          .returns<CompanyResult[]>()
      ])

      // If no results with full-text search, try fallback to ILIKE
      let finalResults = {
        tickets: ticketsResponse.data || [],
        customers: customersResponse.data || [],
        supporters: supportersResponse.data || [],
        companies: companiesResponse.data || []
      }

      if (!finalResults.tickets.length && 
          !finalResults.customers.length && 
          !finalResults.supporters.length && 
          !finalResults.companies.length) {
        const [fallbackTickets, fallbackCustomers, fallbackSupporters, fallbackCompanies] = await Promise.all([
          supabase
            .from('tickets')
            .select(`
              id,
              title,
              created_by_user:users!created_by_user_id (
                full_name
              )
            `)
            .ilike('title', `%${searchQuery}%`)
            .limit(5)
            .returns<TicketResult[]>(),

          supabase
            .from('users')
            .select(`
              id,
              full_name,
              company:companies!company_id (
                company_name
              )
            `)
            .ilike('full_name', `%${searchQuery}%`)
            .limit(5)
            .returns<CustomerResult[]>(),

          supabase
            .from('supporters')
            .select('id, full_name')
            .ilike('full_name', `%${searchQuery}%`)
            .limit(5)
            .returns<SupporterResult[]>(),

          supabase
            .from('companies')
            .select('id, company_name')
            .ilike('company_name', `%${searchQuery}%`)
            .limit(5)
            .returns<CompanyResult[]>()
        ])

        finalResults = {
          tickets: fallbackTickets.data || [],
          customers: fallbackCustomers.data || [],
          supporters: fallbackSupporters.data || [],
          companies: fallbackCompanies.data || []
        }
      }

      const searchResults: SearchResult[] = [
        ...finalResults.tickets.map(ticket => ({
          id: ticket.id,
          type: 'ticket' as const,
          title: ticket.title,
          subtitle: `Created by ${ticket.created_by_user?.full_name || 'Unknown'}`
        })),
        ...finalResults.customers.map(customer => ({
          id: customer.id,
          type: 'customer' as const,
          title: customer.full_name,
          subtitle: customer.company?.company_name
        })),
        ...finalResults.supporters.map(supporter => ({
          id: supporter.id,
          type: 'supporter' as const,
          title: supporter.full_name
        })),
        ...finalResults.companies.map(company => ({
          id: company.id,
          type: 'company' as const,
          title: company.company_name
        }))
      ]

      // Only update results if this is still the current search
      if (!abortControllerRef.current?.signal.aborted) {
        setResults(searchResults)
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Search error:', error)
        toast({
          title: "Search Error",
          description: "Failed to fetch search results. Please try again.",
          variant: "destructive",
        })
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [supabase, toast])

  // Handle query changes with debounce
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (open) { // Only perform search if dialog is open
        performSearch(query)
      }
    }, 500)

    return () => {
      clearTimeout(timeoutId)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, open, performSearch])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    switch (result.type) {
      case 'ticket':
        router.push(`/tickets/${result.id}`)
        break
      case 'customer':
        router.push(`/customer/${result.id}`)
        break
      case 'supporter':
        router.push(`/supporter/${result.id}`)
        break
      case 'company':
        router.push(`/account/${result.id}`)
        break
    }
  }

  return (
    <>
      <button
        onClick={() => handleOpenChange(true)}
        className="relative w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span className="hidden flex-1 text-left lg:block">
            Search tickets, customers, supporters...
          </span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 lg:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </button>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <Command>
          <CommandInput
            placeholder="Search tickets, customers, supporters..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            ) : query.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search...
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No results found.</CommandEmpty>
            ) : (
              <>
                {results.filter(r => r.type === 'ticket').length > 0 && (
                  <CommandGroup heading="Tickets">
                    {results
                      .filter(r => r.type === 'ticket')
                      .map(result => (
                        <CommandItem
                          key={result.id}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center gap-2"
                        >
                          <Ticket className="h-4 w-4" />
                          <div>
                            <div>{result.title}</div>
                            {result.subtitle && (
                              <div className="text-xs text-muted-foreground">
                                {result.subtitle}
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}

                {results.filter(r => r.type === 'customer').length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Customers">
                      {results
                        .filter(r => r.type === 'customer')
                        .map(result => (
                          <CommandItem
                            key={result.id}
                            onSelect={() => handleSelect(result)}
                            className="flex items-center gap-2"
                          >
                            <User className="h-4 w-4" />
                            <div>
                              <div>{result.title}</div>
                              {result.subtitle && (
                                <div className="text-xs text-muted-foreground">
                                  {result.subtitle}
                                </div>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </>
                )}

                {results.filter(r => r.type === 'supporter').length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Supporters">
                      {results
                        .filter(r => r.type === 'supporter')
                        .map(result => (
                          <CommandItem
                            key={result.id}
                            onSelect={() => handleSelect(result)}
                            className="flex items-center gap-2"
                          >
                            <User className="h-4 w-4" />
                            <div>{result.title}</div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </>
                )}

                {results.filter(r => r.type === 'company').length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Companies">
                      {results
                        .filter(r => r.type === 'company')
                        .map(result => (
                          <CommandItem
                            key={result.id}
                            onSelect={() => handleSelect(result)}
                            className="flex items-center gap-2"
                          >
                            <Building2 className="h-4 w-4" />
                            <div>{result.title}</div>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </>
                )}

                <CommandSeparator />
              </>
            )}

            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false)
                  router.push(`/search?q=${encodeURIComponent(query)}`)
                }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span>Search for "{query}" in all items</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
} 