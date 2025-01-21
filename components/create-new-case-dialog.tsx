"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

interface Category {
  id: string
  category_name: string
  description: string | null
}

interface CreateNewCaseDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (categoryId: string, description: string) => void
}

export function CreateNewCaseDialog({ isOpen, onClose, onSubmit }: CreateNewCaseDialogProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState("")
  const [description, setDescription] = useState("")
  const supabase = createClient()

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('category_name')

      if (!error && data) {
        setCategories(data)
      }
    }

    fetchCategories()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(selectedCategoryId, description)
    setSelectedCategoryId("")
    setDescription("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Case</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                Category
              </Label>
              <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} required>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="col-span-3"
                placeholder="Describe your issue..."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Create Case</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

