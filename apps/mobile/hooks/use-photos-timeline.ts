import { useStore } from '@livestore/react'
import { tables } from '@sitelink/domain'
import { queryDb } from '@livestore/livestore'
import { useMemo } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { createAppStoreOptions } from '@/lib/store-config'
import { authClient } from '@/lib/auth'

export interface PhotoWithMarker {
  id: string
  projectId: string
  markerId: string | null
  markerLabel: string | null
  localPath: string
  remotePath: string | null
  isIssue: boolean
  capturedAt: number
  capturedBy: string
}

export interface TimelineSection {
  title: string
  data: CalloutGroup[]
}

export interface CalloutGroup {
  markerId: string | 'unlinked'
  markerLabel: string
  photos: PhotoWithMarker[]
}

export function usePhotosTimeline(projectId: string) {
  // Get session token for store
  const { data } = authClient.useSession()
  const sessionToken = data?.session?.token

  // Get or create store from registry
  const storeOptions = useMemo(() => createAppStoreOptions(sessionToken), [sessionToken])

  const store = useStore(storeOptions)

  // Use store.useQuery() to query with the store context
  const photos = store?.useQuery(
    queryDb(tables.photos.where({ projectId }).orderBy('capturedAt', 'desc'))
  )

  const markers = store.useQuery(queryDb(tables.markers))

  return useMemo(() => {
    // Ensure we have an array to work with
    const photosArray = Array.isArray(photos) ? photos : []
    const markersArray = Array.isArray(markers) ? markers : []

    // Map markers for quick lookup
    const markerMap = new Map(markersArray.map((m) => [m.id, m.label]))

    // Group by date primary
    const groupedByDate: Record<string, PhotoWithMarker[]> = {}

    photosArray.forEach((photo) => {
      const date = new Date(photo.capturedAt)
      let dateKey = format(date, 'yyyy-MM-dd')

      if (isToday(date)) dateKey = 'Today'
      else if (isYesterday(date)) dateKey = 'Yesterday'
      else dateKey = format(date, 'MMMM d, yyyy')

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = []
      }

      groupedByDate[dateKey].push({
        ...photo,
        markerLabel: photo.markerId ? (markerMap.get(photo.markerId) ?? 'Unknown Callout') : null,
      })
    })

    // Group by callout secondary within each date
    const sections: TimelineSection[] = Object.entries(groupedByDate).map(
      ([dateTitle, datePhotos]) => {
        const groupedByCallout: Record<string, CalloutGroup> = {}

        datePhotos.forEach((photo) => {
          const markerId = photo.markerId ?? 'unlinked'
          const markerLabel = photo.markerLabel ?? 'General / Unlinked'

          if (!groupedByCallout[markerId]) {
            groupedByCallout[markerId] = {
              markerId,
              markerLabel,
              photos: [],
            }
          }
          groupedByCallout[markerId].photos.push(photo)
        })

        return {
          title: dateTitle,
          data: Object.values(groupedByCallout),
        }
      }
    )

    return sections
  }, [photos, markers])
}
