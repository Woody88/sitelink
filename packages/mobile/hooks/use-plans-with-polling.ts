import { useEffect, useRef } from "react";
import { usePlans } from "@/lib/api";

/**
 * Hook that polls for plan updates when there are processing plans
 * Polls every 5 seconds while plans are processing, stops when all complete
 */
export function usePlansWithPolling(projectId: string | null) {
  const { data, error, isLoading, refetch } = usePlans(projectId);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Check if any plans are processing
    const hasProcessingPlans = data?.plans?.some(
      (plan) =>
        plan.processingStatus === "processing" || plan.processingStatus === "pending"
    );

    if (hasProcessingPlans) {
      // Start polling every 5 seconds
      if (!pollingIntervalRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          refetch();
        }, 5000);
      }
    } else {
      // Stop polling when no plans are processing
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [data?.plans, refetch]);

  return { data, error, isLoading, refetch };
}
