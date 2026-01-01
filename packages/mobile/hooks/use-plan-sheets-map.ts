import { useState, useEffect } from "react";
import { Effect } from "effect";
import { SheetsApi } from "@/lib/api/client";

/**
 * Hook to fetch sheets for multiple plans and maintain a map of planId -> sheets
 * Only fetches for plans that are processing or have changed
 */
export function usePlanSheetsMap(planIds: string[]) {
  const [sheetsMap, setSheetsMap] = useState<
    Record<string, Array<{ id: string; status: string }>>
  >({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (planIds.length === 0) {
      setSheetsMap({});
      return;
    }

    // Fetch sheets for plans that aren't in the map yet
    const fetchSheets = async () => {
      setIsLoading(true);
      const newSheetsMap: Record<string, Array<{ id: string; status: string }>> = {
        ...sheetsMap,
      };

      await Promise.all(
        planIds.map(async (planId) => {
          // Only fetch if not already in map
          if (!newSheetsMap[planId]) {
            try {
              const result = await Effect.runPromise(SheetsApi.list(planId));
              newSheetsMap[planId] = result.sheets.map((sheet) => ({
                id: sheet.id,
                status: sheet.processingStatus,
              }));
            } catch (error) {
              console.warn(`Failed to fetch sheets for plan ${planId}:`, error);
              newSheetsMap[planId] = [];
            }
          }
        })
      );

      setSheetsMap(newSheetsMap);
      setIsLoading(false);
    };

    fetchSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIds.join(",")]); // Only re-run when plan IDs change

  return { sheetsMap, isLoading };
}
