"use client"

import * as React from "react"
import { useState } from "react"
import { ChevronDown, ChevronUp, Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTemplates } from "@/hooks/use-templates"
import { useToast } from "@/components/ui/use-toast"

interface ResponseTemplatesProps {
  categoryId: string | null
  onSelectTemplate: (content: string) => void
}

export function ResponseTemplates({ categoryId, onSelectTemplate }: ResponseTemplatesProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: "", content: "" })
  const { templates, isLoading, error, createTemplate } = useTemplates(categoryId)
  const { toast } = useToast()

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.content.trim()) {
      toast({
        title: "Error",
        description: "Template name and content are required",
        variant: "destructive",
      })
      return
    }

    try {
      await createTemplate(newTemplate.name.trim(), newTemplate.content.trim())
      setNewTemplate({ name: "", content: "" })
      setIsCreating(false)
      toast({
        title: "Success",
        description: "Template created successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create template. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="mt-4">
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-medium">Response Templates</h3>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </div>

      {isExpanded && (
        <div className="p-4 border-t">
          {isLoading ? (
            <div className="text-center text-gray-500">Loading templates...</div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : templates.length === 0 ? (
            <div className="text-center text-gray-500">
              No templates available for this category
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border rounded-md hover:bg-gray-50 cursor-pointer"
                    onClick={() => onSelectTemplate(template.content)}
                  >
                    <h4 className="font-medium mb-2">{template.template_name}</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {template.content}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {!isCreating ? (
            <Button
              className="mt-4 w-full"
              variant="outline"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Template
            </Button>
          ) : (
            <div className="mt-4 space-y-4">
              <Input
                placeholder="Template Name"
                value={newTemplate.name}
                onChange={(e) =>
                  setNewTemplate((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <Textarea
                placeholder="Template Content"
                value={newTemplate.content}
                onChange={(e) =>
                  setNewTemplate((prev) => ({ ...prev, content: e.target.value }))
                }
                rows={4}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false)
                    setNewTemplate({ name: "", content: "" })
                  }}
                >
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleCreateTemplate}>
                  Create Template
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
} 