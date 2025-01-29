import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface MentionSearchResult {
  entityId: string;
  entityType: "ticket" | "supporter" | "customer" | "account" | "category";
  displayName: string;
  secondaryText: string;
}

interface SearchMentionsParams {
  search_query: string;
  max_results: number;
}

export function useMentionSearch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const supabase = createClient();

  const searchMentions = useCallback(
    async (query: string): Promise<MentionSearchResult[]> => {
      if (!query) {
        console.log("Empty query, returning empty results");
        return [];
      }

      setIsLoading(true);
      setError(null);
      console.log("Searching for:", query);

      try {
        const { data, error } = await supabase.rpc("search_mentions", {
          search_query: query,
          max_results: 5,
        });

        if (error) {
          console.error("Search error:", error);
          throw error;
        }

        console.log("Raw search results:", data);

        const results = (data as Array<{
          entity_id: string;
          entity_type: string;
          display_name: string;
          secondary_text: string;
        }>)?.map((item) => ({
          entityId: item.entity_id,
          entityType: item.entity_type as MentionSearchResult["entityType"],
          displayName: item.display_name,
          secondaryText: item.secondary_text,
        })) || [];

        console.log("Processed results:", results);
        return results;
      } catch (err) {
        const error = err as Error;
        console.error("Search error:", error);
        setError(error);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [supabase]
  );

  return {
    searchMentions,
    isLoading,
    error,
  };
} 