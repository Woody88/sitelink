import { useStore } from '@livestore/react'
import { tables } from '@sitelink/domain'
import { queryDb } from '@livestore/livestore'
import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { createAppStoreOptions } from '@/lib/store-config'
import { authClient } from '@/lib/auth'

export interface ProjectWithStats {
  id: string
  name: string
  address: string | null
  sheetCount: number
  photoCount: number
  memberCount: number
  updatedAt: string
  status: 'active' | 'archived' | 'completed'
}

export function useProjects() {
  const { data } = authClient.useSession()
  const sessionToken = data?.session?.token

  const storeOptions = useMemo(
    () => createAppStoreOptions(sessionToken ?? ''),
    [sessionToken]
  )

  const store = useStore(storeOptions)

  const projects = store?.useQuery(
    queryDb(
      tables.projects
        .orderBy('updatedAt', 'desc')
    )
  )

  const sheets = store?.useQuery(queryDb(tables.sheets))
  const photos = store?.useQuery(queryDb(tables.photos))
  const organizationMembers = store?.useQuery(queryDb(tables.organizationMembers))

  if (projects) {
    console.log(`[useProjects] Found ${projects.length} projects:`, projects.map(p => p.name).join(', '));
  }

  return useMemo(() => {
    if (!projects) return undefined

    const projectsArray = projects
    const sheetsArray = Array.isArray(sheets) ? sheets : []
    const photosArray = Array.isArray(photos) ? photos : []
    const membersArray = Array.isArray(organizationMembers) ? organizationMembers : []

    const projectStats = projectsArray.map(project => {
      const projectSheets = sheetsArray.filter(s => s.projectId === project.id)
      const projectPhotos = photosArray.filter(p => p.projectId === project.id)
      const memberCount = membersArray.length || 1

      const status: 'active' | 'archived' | 'completed' = project.isArchived
        ? 'archived'
        : 'active'

      return {
        id: project.id,
        name: project.name,
        address: project.address,
        sheetCount: projectSheets.length,
        photoCount: projectPhotos.length,
        memberCount,
        updatedAt: formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true }),
        status,
      }
    })

    return projectStats
  }, [projects, sheets, photos, organizationMembers])
}
