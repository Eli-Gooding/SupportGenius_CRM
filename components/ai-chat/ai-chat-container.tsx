"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PanelRightOpen, Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AIChatWindow } from "./ai-chat-window";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface AIChatContainerProps {
  className?: string;
}

export function AIChatContainer({ className }: AIChatContainerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [chats, setChats] = useState<Array<{
    id: string;
    title: string;
    created_at: string;
    last_message?: string;
  }>>([]);
  const supabase = createClient();
  const { user } = useAuth();

  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleNewChat = () => {
    setNewChatTitle("");
    setShowNewChatDialog(true);
  };

  const createNewChat = async () => {
    if (!user?.id || !newChatTitle.trim()) return;

    try {
      // Create a new chat session in the database
      const { data: chatSession, error } = await supabase
        .from("ai_chat_sessions")
        .insert({
          supporter_id: user.id,
          title: newChatTitle.trim(),
          status: "active"
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state with the new chat
      setChats(prev => [...prev, { 
        id: chatSession.id, 
        title: chatSession.title, 
        created_at: chatSession.created_at 
      }]);
      setActiveChat(chatSession.id);
      setShowNewChatDialog(false);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  };

  // Load existing chats on mount
  useEffect(() => {
    const loadChats = async () => {
      if (!user?.id) return;

      try {
        const { data: chatSessions, error } = await supabase
          .from("ai_chat_sessions")
          .select(`
            id, 
            title, 
            created_at,
            ai_chat_messages!inner (
              content,
              created_at
            )
          `)
          .eq("supporter_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Process the chat sessions to include the last message
        const processedChats = chatSessions.map(chat => ({
          id: chat.id,
          title: chat.title,
          created_at: chat.created_at,
          last_message: chat.ai_chat_messages?.[0]?.content
        }));

        setChats(processedChats);
      } catch (error) {
        console.error("Failed to load chats:", error);
        // You could add a toast notification here
      }
    };

    loadChats();
  }, [user?.id, supabase]);

  // Helper function to format the date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return "Today";
    } else if (diffInDays === 1) {
      return "Yesterday";
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <>
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Chat</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Enter chat title..."
              value={newChatTitle}
              onChange={(e) => setNewChatTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newChatTitle.trim()) {
                  createNewChat();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setShowNewChatDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={createNewChat}
              disabled={!newChatTitle.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "fixed right-0 top-0 z-40 h-screen transition-all duration-300",
          isOpen ? "w-96" : "w-12",
          className
        )}
      >
        <div className="flex h-full flex-col border-l bg-background">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b px-4">
            {isOpen ? (
              <>
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNewChat}
                    title="New Chat"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    title="Close Sidebar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="w-full"
                title="Open AI Assistant"
              >
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Chat Content */}
          {isOpen && (
            <div className="flex flex-1 flex-col">
              {/* Always show the chat list */}
              <ScrollArea className="flex-none border-b">
                <div className="p-4">
                  {chats.length === 0 ? (
                    <div className="flex h-16 items-center justify-center text-muted-foreground">
                      No chats yet. Create one to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chats.map((chat) => (
                        <Button
                          key={chat.id}
                          variant={activeChat === chat.id ? "secondary" : "ghost"}
                          className="w-full flex flex-col items-start gap-1 h-auto py-3"
                          onClick={() => setActiveChat(chat.id)}
                        >
                          <div className="flex justify-between w-full text-sm">
                            <span className="font-medium">{chat.title}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatDate(chat.created_at)}
                            </span>
                          </div>
                          {chat.last_message && (
                            <span className="text-xs text-muted-foreground truncate w-full text-left">
                              {chat.last_message.length > 50 
                                ? `${chat.last_message.slice(0, 50)}...` 
                                : chat.last_message}
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Show chat window below the list if there's an active chat */}
              {activeChat && (
                <div className="flex-1">
                  <AIChatWindow chatId={activeChat} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
} 