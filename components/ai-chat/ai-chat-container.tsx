"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PanelRightOpen, Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AIChatWindow } from "./ai-chat-window";

interface AIChatContainerProps {
  className?: string;
}

export function AIChatContainer({ className }: AIChatContainerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chats, setChats] = useState<string[]>([]); // This will be replaced with actual chat objects

  const toggleSidebar = () => setIsOpen(!isOpen);

  const createNewChat = () => {
    const newChatId = `chat-${Date.now()}`; // Temporary ID generation
    setChats([...chats, newChatId]);
    setActiveChat(newChatId);
  };

  return (
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
                  onClick={createNewChat}
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
            {activeChat ? (
              <AIChatWindow chatId={activeChat} />
            ) : (
              /* Chat List */
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {chats.length === 0 ? (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                      No chats yet. Create one to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chats.map((chatId) => (
                        <Button
                          key={chatId}
                          variant={activeChat === chatId ? "secondary" : "ghost"}
                          className="w-full justify-start"
                          onClick={() => setActiveChat(chatId)}
                        >
                          Chat {chatId.split("-")[1]}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 