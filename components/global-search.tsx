"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2, Search, Ticket, User } from "lucide-react"
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

interface SearchResult {
  id: string
  type: 'ticket' | 'customer' | 'supporter' | 'company'
  title: string
  subtitle?: string
}

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()
  const supabase = createClient()

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

  React.useEffect(() => {
    const search = async () => {
      if (!query) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        // Search tickets
        const { data: tickets } = await supabase
          .from('tickets')
          .select(`
            id,
            title,
            created_by_user:users!created_by_user_id (
              full_name
            )
          `)
          .ilike('title', `%${query}%`)
          .limit(5)

        // Search customers (users)
        const { data: customers } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            company:companies!company_id (
              company_name
            )
          `)
          .ilike('full_name', `%${query}%`)
          .limit(5)

        // Search supporters
        const { data: supporters } = await supabase
          .from('supporters')
          .select('id, full_name')
          .ilike('full_name', `%${query}%`)
          .limit(5)

        // Search companies
        const { data: companies } = await supabase
          .from('companies')
          .select('id, company_name')
          .ilike('company_name', `%${query}%`)
          .limit(5)

        const searchResults: SearchResult[] = [
          ...(tickets?.map(ticket => ({
            id: ticket.id,
            type: 'ticket' as const,
            title: ticket.title,
            subtitle: `Created by ${ticket.created_by_user?.full_name || 'Unknown'}`
          })) || []),
          ...(customers?.map(customer => ({
            id: customer.id,
            type: 'customer' as const,
            title: customer.full_name,
            subtitle: customer.company?.company_name
          })) || []),
          ...(supporters?.map(supporter => ({
            id: supporter.id,
            type: 'supporter' as const,
            title: supporter.full_name
          })) || []),
          ...(companies?.map(company => ({
            id: company.id,
            type: 'company' as const,
            title: company.company_name
          })) || [])
        ]

        setResults(searchResults)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(search, 300)
    return () => clearTimeout(timeoutId)
  }, [query])

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
        onClick={() => setOpen(true)}
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
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput
            placeholder="Search tickets, customers, supporters..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {results.length > 0 && (
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
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
} 