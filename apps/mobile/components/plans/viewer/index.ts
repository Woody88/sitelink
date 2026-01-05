/**
 * Plan Viewer Components
 *
 * A world-class plan viewer built with OpenSeadragon and Expo DOM components.
 * Follows Wealthsimple-inspired design principles: clean, professional, minimal.
 *
 * Usage:
 * ```tsx
 * import { PlanViewer } from '@/components/plans/viewer'
 *
 * <PlanViewer
 *   planId="p1"
 *   planCode="A2.01-1"
 *   planTitle="Building 1 Floor Plan"
 *   imageUrl="https://example.com/plan.jpg"
 *   onClose={() => setShowViewer(false)}
 * />
 * ```
 */

export { PlanViewer, default } from './plan-viewer'
export { ViewerControls, ZoomSlider } from './viewer-controls'
export { SheetInfoBar, CompactSheetInfo } from './sheet-info-bar'
export { MarkerDetailSheet, MarkerInfoCard } from './marker-detail-sheet'
export { default as OpenSeadragonViewer } from './openseadragon-viewer'
