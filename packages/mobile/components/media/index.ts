/**
 * Media Components
 *
 * Construction site photo documentation with auto-bundling by work state.
 * Designed for workers with dirty hands, gloves, and limited time.
 */

// Work State - the core concept
export { WorkStateBadge, WorkStateSelector } from "./work-state-badge";
export type { WorkState } from "./work-state-badge";

// Sync Status - offline-first is critical
export { SyncStatusBadge, getSummaryStatus, countPendingItems } from "./sync-status-badge";
export type { SyncStatus } from "./sync-status-badge";

// Photo Status - individual photo work state
export {
  PhotoStatusBadge,
  PhotoStatusSelector,
  PhotoStatusInlineSelector,
  getPhotoStatusConfig,
} from "./photo-status-badge";
export type { PhotoStatus } from "./photo-status-badge";

// Photo Components
export { PhotoThumbnail } from "./photo-thumbnail";
export type { PhotoData } from "./photo-thumbnail";

export { PhotoBundleCard } from "./photo-bundle-card";
export type { PhotoBundle } from "./photo-bundle-card";

// Timeline
export { TimelineDateHeader } from "./timeline-date-header";

// Filters
export { MediaFilterBar } from "./media-filter-bar";
export type { DateFilter } from "./media-filter-bar";

// Header
export { MediaHeader } from "./media-header";

// Empty States
export { MediaEmptyState } from "./empty-state";

// Photo Viewer
export { PhotoViewer } from "./photo-viewer";

// Label Input Modal
export { LabelInputModal } from "./label-input-modal";
export type { LabelInputModalProps } from "./label-input-modal";

// Marker Timeline
export { MarkerTimelineModal } from "./marker-timeline-modal";

// Bundle Actions
export { BundleActionsSheet } from "./bundle-actions-sheet";
export type { BundleActionsSheetProps } from "./bundle-actions-sheet";
export { DeleteBundleDialog } from "./delete-bundle-dialog";
export type { DeleteBundleDialogProps } from "./delete-bundle-dialog";

// Search
export { SearchFilters } from "./search-filters";
export type { SearchFiltersProps } from "./search-filters";
