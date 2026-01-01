import { useState, useCallback, useRef } from "react";
import { Effect } from "effect";
import { PlansApi, ProcessingApi, type ApiErrorType } from "@/lib/api/client";
import type { DocumentPickerAsset } from "expo-document-picker";

/** Maximum file size in bytes (100MB) */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Polling interval for job status (2 seconds) */
const POLL_INTERVAL_MS = 2000;

/** Valid MIME types for PDF files */
const VALID_MIME_TYPES = ["application/pdf"];

export type UploadErrorType =
  | "invalid_file"
  | "file_too_large"
  | "network_error"
  | "upload_failed"
  | "processing_failed"
  | "unauthorized";

export interface UsePlanUploadReturn {
  isUploading: boolean;
  uploadProgress: number;
  estimatedTimeRemaining: number | null;
  currentFileName: string | null;
  error: UploadErrorType | null;
  errorMessage: string | null;
  isProcessing: boolean; // True after upload completes, while processing
  processingProgress: number; // Processing progress (0-100)
  startUpload: (projectId: string, file: DocumentPickerAsset) => Promise<boolean>;
  cancelUpload: () => void;
  clearError: () => void;
}

/**
 * Calculate estimated time remaining based on progress
 */
function calculateTimeRemaining(
  progress: number,
  startTime: number
): number | null {
  if (progress <= 0) return null;

  const elapsed = Date.now() - startTime;
  const estimatedTotal = (elapsed / progress) * 100;
  const remaining = Math.max(0, Math.ceil((estimatedTotal - elapsed) / 1000));

  return remaining;
}

/**
 * Hook for managing plan PDF upload with progress tracking
 */
export function usePlanUpload(): UsePlanUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [error, setError] = useState<UploadErrorType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearError = useCallback(() => {
    setError(null);
    setErrorMessage(null);
  }, []);

  const cancelUpload = useCallback(() => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Reset state
    setIsUploading(false);
    setUploadProgress(0);
    setEstimatedTimeRemaining(null);
    setCurrentFileName(null);
    setIsProcessing(false);
    setProcessingProgress(0);
  }, []);

  const startUpload = useCallback(
    async (projectId: string, file: DocumentPickerAsset): Promise<boolean> => {
      // Validate file
      if (!file.uri || !file.name) {
        setError("invalid_file");
        setErrorMessage("Invalid file selected");
        return false;
      }

      // Check file size
      if (file.size && file.size > MAX_FILE_SIZE) {
        setError("file_too_large");
        setErrorMessage(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        return false;
      }

      // Check MIME type
      const mimeType = file.mimeType || "application/pdf";
      if (!VALID_MIME_TYPES.includes(mimeType)) {
        setError("invalid_file");
        setErrorMessage("Only PDF files are supported");
        return false;
      }

      // Clear any previous errors and start upload
      clearError();
      setIsUploading(true);
      setUploadProgress(0);
      setCurrentFileName(file.name);
      startTimeRef.current = Date.now();

      try {
        // Create abort controller
        abortControllerRef.current = new AbortController();

        // Upload the file
        const uploadResult = await Effect.runPromise(
          PlansApi.upload(
            projectId,
            {
              uri: file.uri,
              name: file.name,
              type: mimeType,
            },
            { name: file.name.replace(/\.pdf$/i, "") }
          )
        );

        const { jobId } = uploadResult;

        // Upload is complete, now processing
        setIsUploading(false);
        setUploadProgress(100);
        setIsProcessing(true);

        // Start polling for job status
        return new Promise((resolve) => {
          pollingIntervalRef.current = setInterval(async () => {
            try {
              const jobStatus = await Effect.runPromise(
                ProcessingApi.getJobStatus(jobId)
              );

              // Update processing progress
              const progress = jobStatus.progress ?? 0;
              setProcessingProgress(progress);

              // Check for completion
              if (jobStatus.status === "completed") {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                setIsProcessing(false);
                setProcessingProgress(100);
                setEstimatedTimeRemaining(0);
                resolve(true);
              }

              // Check for failure
              if (jobStatus.status === "failed") {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                setError("processing_failed");
                setErrorMessage(jobStatus.lastError || "Processing failed");
                setIsProcessing(false);
                resolve(false);
              }
            } catch (pollError) {
              // Continue polling on transient errors
              console.warn("Job status poll failed:", pollError);
            }
          }, POLL_INTERVAL_MS);
        });
      } catch (uploadError) {
        // Handle upload errors
        const apiError = uploadError as ApiErrorType;

        if ("_tag" in apiError) {
          switch (apiError._tag) {
            case "UnauthorizedError":
              setError("unauthorized");
              setErrorMessage("Please sign in to upload plans");
              break;
            case "NetworkError":
              setError("network_error");
              setErrorMessage("Network error. Please check your connection.");
              break;
            default:
              setError("upload_failed");
              setErrorMessage(
                "message" in apiError
                  ? (apiError.message as string)
                  : "Upload failed"
              );
          }
        } else {
          setError("upload_failed");
          setErrorMessage("Upload failed. Please try again.");
        }

        setIsUploading(false);
        return false;
      }
    },
    [clearError]
  );

  return {
    isUploading,
    uploadProgress,
    estimatedTimeRemaining,
    currentFileName,
    error,
    errorMessage,
    isProcessing,
    processingProgress,
    startUpload,
    cancelUpload,
    clearError,
  };
}
