"use client";

import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useMentionSearch, MentionSearchResult } from "@/hooks/use-mention-search";
import { useAIChat } from "@/hooks/use-ai-chat";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  isStreaming?: boolean;
}

interface AIChatWindowProps {
  chatId: string;
  className?: string;
}

export function AIChatWindow({ chatId, className }: AIChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentions, setMentions] = useState<MentionSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [chatTitle, setChatTitle] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { searchMentions, isLoading: isLoadingMentions } = useMentionSearch();
  const supabase = createClient();

  const { sendMessage, isLoading } = useAIChat({
    sessionId: chatId,
    supporterId: user?.id || "",
    onToken: (token) => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.sender === "ai" && lastMessage.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: lastMessage.content + token },
          ];
        }
        return prev;
      });
    },
    onError: (error) => {
      console.error("AI Chat Error:", error);
      // You could add a toast notification here
    },
    onComplete: () => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.sender === "ai" && lastMessage.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, isStreaming: false },
          ];
        }
        return prev;
      });
    },
  });

  // Load chat messages
  useEffect(() => {
    const loadChatMessages = async () => {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("*")
        .eq("chat_session_id", chatId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load chat messages:", error);
        return;
      }

      if (data) {
        const formattedMessages: Message[] = data.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender_type === "user" ? "user" : "ai",
          timestamp: new Date(msg.created_at),
          isStreaming: false
        }));
        setMessages(formattedMessages);
      }
    };

    loadChatMessages();
  }, [chatId, supabase]);

  // Load chat title
  useEffect(() => {
    const loadChatTitle = async () => {
      const { data, error } = await supabase
        .from("ai_chat_sessions")
        .select("title")
        .eq("id", chatId)
        .single();

      if (!error && data) {
        setChatTitle(data.title);
      }
    };

    loadChatTitle();
  }, [chatId, supabase]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset selected index when mentions list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [mentions]);

  useEffect(() => {
    const fetchMentions = async () => {
      if (mentionSearch !== undefined) {
        const results = await searchMentions(mentionSearch);
        setMentions(results);
      } else {
        setMentions([]);
      }
    };

    fetchMentions();
  }, [mentionSearch, searchMentions]);

  // Function to format the display text with bold mentions
  const formatDisplayText = (text: string): JSX.Element => {
    const parts = text.split(/(@[^:\s]+:[^:\s]+:[^\s]+)/g);
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith("@") && part.includes(":")) {
            // Extract just the name from the mention
            const name = part.split(":")[2];
            return <strong key={index}>@{name}</strong>;
          }
          return part;
        })}
      </>
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setDisplayValue(value);
    
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      const nextSpaceIndex = textAfterAt.indexOf(" ");
      
      const searchText = nextSpaceIndex === -1 
        ? textAfterAt 
        : textAfterAt.slice(0, nextSpaceIndex);
      
      const isCursorInMention = nextSpaceIndex === -1 || 
        cursorPos <= atIndex + nextSpaceIndex + 1;
      
      if (isCursorInMention) {
        setMentionSearch(searchText);
        setShowMentions(true);
      } else {
        setShowMentions(false);
        setMentionSearch("");
      }
    } else {
      setShowMentions(false);
      setMentionSearch("");
    }
  };

  const handleMentionSelect = (mention: MentionSearchResult) => {
    const textBeforeMention = inputValue.slice(0, cursorPosition).lastIndexOf("@");
    const textAfterCursor = inputValue.slice(cursorPosition);
    
    const nextSpaceIndex = textAfterCursor.indexOf(" ");
    const textAfterMention = nextSpaceIndex === -1 
      ? textAfterCursor 
      : textAfterCursor.slice(nextSpaceIndex);
    
    // Create both the storage and display versions
    const mentionStorage = `@${mention.entityType}:${mention.entityId}:${mention.displayName}`;
    const mentionDisplay = `@${mention.displayName}`;
    
    const newStorageValue = 
      inputValue.slice(0, textBeforeMention) +
      mentionStorage +
      textAfterMention;
    
    const newDisplayValue = 
      inputValue.slice(0, textBeforeMention) +
      mentionDisplay +
      textAfterMention;
    
    setInputValue(newStorageValue);
    setDisplayValue(newDisplayValue);
    setShowMentions(false);
    setMentionSearch("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && mentions.length > 0) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % mentions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + mentions.length) % mentions.length);
          break;
        case "Enter":
          e.preventDefault();
          handleMentionSelect(mentions[selectedIndex]);
          break;
        case "Escape":
          e.preventDefault();
          setShowMentions(false);
          setMentionSearch("");
          break;
        case "Tab":
          e.preventDefault();
          handleMentionSelect(mentions[selectedIndex]);
          break;
      }
    } else if (e.key === "Enter" && !showMentions && !isLoading) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    try {
      // First, save the user's message to the database
      const { data: savedMessage, error: saveError } = await supabase
        .from("ai_chat_messages")
        .insert({
          chat_session_id: chatId,
          sender_type: "user",
          content: inputValue,
        })
        .select()
        .single();

      if (saveError) {
        console.error("Failed to save user message:", saveError);
        return;
      }

      // Update local state with the saved message
      const userMessage: Message = {
        id: savedMessage.id,
        content: savedMessage.content,
        sender: "user",
        timestamp: new Date(savedMessage.created_at),
      };

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "",
        sender: "ai",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, aiMessage]);
      setInputValue("");
      setDisplayValue("");

      // Now send the message to the AI
      await sendMessage(inputValue);
    } catch (error) {
      console.error("Failed to send message:", error);
      // You could add a toast notification here
    }
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Chat Title */}
      <div className="border-b px-4 py-2">
        <h3 className="font-medium">{chatTitle}</h3>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg p-3",
                message.sender === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted",
                message.isStreaming && "animate-pulse"
              )}
            >
              {formatDisplayText(message.content)}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="relative">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={displayValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? "AI is thinking..." : "Type your message... Use @ to mention"}
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              size="icon" 
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Mentions Dropdown */}
          {showMentions && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50">
              <Command className="border shadow-md rounded-lg bg-background">
                <CommandGroup heading="Mentions">
                  {isLoadingMentions ? (
                    <CommandItem disabled>Loading...</CommandItem>
                  ) : mentions.length === 0 ? (
                    <CommandItem disabled>No results found</CommandItem>
                  ) : (
                    mentions.map((mention, index) => (
                      <CommandItem
                        key={mention.entityId}
                        value={mention.entityId}
                        onSelect={() => handleMentionSelect(mention)}
                        className={cn(
                          "flex flex-col items-start gap-1 py-2 cursor-pointer",
                          selectedIndex === index && "bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded capitalize">
                            {mention.entityType}
                          </span>
                          <span className="font-medium">{mention.displayName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {mention.secondaryText}
                        </span>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </Command>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 