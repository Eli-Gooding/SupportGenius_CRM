"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Search } from "lucide-react"

interface DocCategory {
  id: string
  category_name: string
  category_description: string
}

interface Document {
  id: string
  doc_title: string
  doc_description: string
  storage_path: string
  category: DocCategory
}

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [categories, setCategories] = useState<DocCategory[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        // Verify supporter status
        const { data: supporter } = await supabase
          .from('supporters')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!supporter) {
          router.push('/login')
          return
        }

        // Fetch categories
        const { data: categories, error: categoriesError } = await supabase
          .from('doc_categories')
          .select('*')
          .order('category_name')

        if (categoriesError) throw categoriesError
        setCategories(categories || [])

        // Fetch documents
        const { data: documents, error: documentsError } = await supabase
          .from('product_documentation')
          .select(`
            *,
            category:category_id (
              id,
              category_name,
              category_description
            )
          `)
          .order('doc_title')

        if (documentsError) throw documentsError
        setDocuments(documents || [])
      } catch (error) {
        console.error('Error fetching knowledge base:', error)
        toast({
          title: "Error",
          description: "Failed to load knowledge base",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = searchQuery === "" || 
      doc.doc_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.doc_description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = !selectedCategory || doc.category?.id === selectedCategory

    return matchesSearch && matchesCategory
  })

  const handleDocumentClick = async (document: Document) => {
    try {
      const { data: signedUrl, error } = await supabase
        .storage
        .from('documentation')
        .createSignedUrl(document.storage_path, 3600)

      if (error) throw error

      window.open(signedUrl.signedUrl, '_blank')
    } catch (error) {
      console.error('Error accessing document:', error)
      toast({
        title: "Error",
        description: "Failed to access document",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex flex-col space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-semibold text-gray-900">Knowledge Base</h1>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="w-64">
              <Card>
                <CardHeader>
                  <CardTitle>Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[calc(100vh-300px)]">
                    <div className="space-y-2">
                      <Button
                        variant={selectedCategory === null ? "secondary" : "ghost"}
                        className="w-full justify-start"
                        onClick={() => setSelectedCategory(null)}
                      >
                        All Documents
                      </Button>
                      {categories.map((category) => (
                        <Button
                          key={category.id}
                          variant={selectedCategory === category.id ? "secondary" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setSelectedCategory(category.id)}
                        >
                          {category.category_name}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="flex-1">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="grid grid-cols-1 gap-4">
                  {filteredDocuments.map((document) => (
                    <Card
                      key={document.id}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleDocumentClick(document)}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>{document.doc_title}</CardTitle>
                            {document.doc_description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {document.doc_description}
                              </p>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {document.category?.category_name}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                  {filteredDocuments.length === 0 && (
                    <p className="text-center text-gray-500 py-4">
                      No documents found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 