import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface UseAIChatOptions {
  sessionId: string;
  supporterId: string;
  onToken?: (token: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export function useAIChat({
  sessionId,
  supporterId,
  onToken,
  onError,
  onComplete,
}: UseAIChatOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const sendMessage = useCallback(
    async (message: string) => {
      setIsLoading(true);

      try {
        // Get the function URL and anon key from environment variables
        const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!functionUrl || !anonKey) {
          throw new Error("Missing required environment variables");
        }

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            sessionId,
            supporterId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to send message");
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Convert the chunk to text
          const chunk = decoder.decode(value);
          fullResponse += chunk;
          onToken?.(chunk);
        }

        // Store the message in the local database
        await supabase.from("ai_chat_messages").insert([
          {
            chat_session_id: sessionId,
            sender_type: "user",
            content: message,
          },
          {
            chat_session_id: sessionId,
            sender_type: "llm",
            content: fullResponse,
          },
        ]);

        onComplete?.();
        return fullResponse;
      } catch (error) {
        console.error("AI Chat Error:", error);
        if (error instanceof Error) {
          onError?.(error);
        } else {
          onError?.(new Error("An unknown error occurred"));
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, supporterId, onToken, onError, onComplete, supabase]
  );

  return {
    sendMessage,
    isLoading,
  };
} 