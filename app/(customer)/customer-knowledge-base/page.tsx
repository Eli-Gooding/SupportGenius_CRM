"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { Search } from "lucide-react"

interface Document {
  id: string
  doc_title: string
  doc_description: string
  category_id: string
  storage_path: string
}

interface Category {
  id: string
  category_name: string
  category_description: string
}

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const { toast } = useToast()

  const fetchDocuments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: docs, error } = await supabase
        .from('product_documentation')
        .select(`
          id,
          doc_title,
          doc_description,
          category_id,
          storage_path
        `)
        .textSearch('doc_title', searchQuery, {
          type: 'websearch',
          config: 'english'
        })

      if (error) throw error
      setDocuments(docs || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast({
        title: "Error",
        description: "Failed to load documents. Please try again later.",
        variant: "destructive",
      })
    }
  }

  const fetchCategories = async () => {
    try {
      const { data: cats, error } = await supabase
        .from('doc_categories')
        .select('*')
        .order('category_name')

      if (error) throw error
      setCategories(cats || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [searchQuery])

  const groupedDocuments = documents.reduce((acc, doc) => {
    const category = categories.find(c => c.id === doc.category_id)
    const categoryName = category?.category_name || 'Uncategorized'
    
    if (!acc[categoryName]) {
      acc[categoryName] = []
    }
    acc[categoryName].push(doc)
    return acc
  }, {} as Record<string, Document[]>)

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-semibold text-gray-900">Knowledge Base</h1>
          <div className="relative w-96">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search documentation..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-8">
          {Object.entries(groupedDocuments).map(([category, docs]) => (
            <div key={category}>
              <h2 className="text-xl font-semibold mb-4">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {docs.map((doc) => (
                  <Card key={doc.id} className="cursor-pointer hover:bg-gray-50">
                    <CardHeader>
                      <CardTitle className="text-lg">{doc.doc_title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500">{doc.doc_description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groupedDocuments).length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No documents found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 