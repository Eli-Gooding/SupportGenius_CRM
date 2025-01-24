import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Template = {
  id: string
  template_name: string
  content: string
  created_by_supporter_id: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useTemplates(categoryId: string | null) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchTemplates = async () => {
      if (!categoryId) {
        setTemplates([])
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const { data, error } = await supabase
          .from('templates')
          .select(`
            *,
            template_mappings!inner(ticket_category_id)
          `)
          .eq('template_mappings.ticket_category_id', categoryId)
          .eq('is_active', true)
          .order('template_name')

        if (error) throw error
        setTemplates(data || [])
      } catch (err) {
        console.error('Error fetching templates:', err)
        setError(err instanceof Error ? err.message : 'An error occurred while fetching templates')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTemplates()
  }, [categoryId])

  const createTemplate = async (templateName: string, content: string) => {
    if (!categoryId) return null

    try {
      // First create the template
      const { data: templateData, error: templateError } = await supabase
        .from('templates')
        .insert({
          template_name: templateName,
          content: content,
          is_active: true
        })
        .select()
        .single()

      if (templateError) throw templateError

      // Then create the template mapping
      const { error: mappingError } = await supabase
        .from('template_mappings')
        .insert({
          template_id: templateData.id,
          ticket_category_id: categoryId
        })

      if (mappingError) throw mappingError

      // Refresh templates
      const { data: updatedTemplates, error: fetchError } = await supabase
        .from('templates')
        .select(`
          *,
          template_mappings!inner(ticket_category_id)
        `)
        .eq('template_mappings.ticket_category_id', categoryId)
        .eq('is_active', true)
        .order('template_name')

      if (fetchError) throw fetchError
      setTemplates(updatedTemplates || [])

      return templateData
    } catch (err) {
      console.error('Error creating template:', err)
      throw err
    }
  }

  return {
    templates,
    isLoading,
    error,
    createTemplate
  }
} 