import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export type Company = {
  id: string
  company_name: string
}

export function useCompanies(searchTerm: string = '') {
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoading(true)
      setError(null)

      try {
        let query = supabase
          .from('companies')
          .select('id, company_name')
          .order('company_name')

        // If there's a search term, add ilike filter
        if (searchTerm) {
          query = query.ilike('company_name', `%${searchTerm}%`)
        }

        const { data, error } = await query

        if (error) {
          throw error
        }

        setCompanies(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching companies')
      } finally {
        setIsLoading(false)
      }
    }

    // Debounce the search to avoid too many requests
    const timeoutId = setTimeout(fetchCompanies, 300)
    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  return { companies, isLoading, error }
} 