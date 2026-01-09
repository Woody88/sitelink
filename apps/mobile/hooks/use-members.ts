import { useStore } from '@livestore/react'
import { tables } from '@sitelink/domain'
import { queryDb } from '@livestore/livestore'
import { useMemo } from 'react'
import { createAppStoreOptions } from '@/lib/store-config'
import { authClient } from '@/lib/auth'

export interface Member {
  id: string
  userId: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
}

export function useMembers(projectId: string) {
  const { data } = authClient.useSession()
  const sessionToken = data?.session?.token

  const storeOptions = useMemo(
    () => createAppStoreOptions(sessionToken),
    [sessionToken]
  )

  const store = useStore(storeOptions)

  const project = store.useQuery(queryDb(tables.projects.where({ id: projectId })))

  const organizationId = useMemo(() => {
    const projectsArray = Array.isArray(project) ? project : []
    return projectsArray[0]?.organizationId
  }, [project])

  const organizationMembers = store.useQuery(
    queryDb(
      tables.organizationMembers.where(
        organizationId ? { organizationId } : { organizationId: '__none__' }
      )
    )
  )

  const users = store.useQuery(queryDb(tables.users))

  return useMemo(() => {
    const membersArray = Array.isArray(organizationMembers) ? organizationMembers : []
    const usersArray = Array.isArray(users) ? users : []

    const userMap = new Map(usersArray.map((u) => [u.id, u]))

    const members: Member[] = membersArray
      .map((member) => {
        const user = userMap.get(member.userId)
        if (!user) return null

        return {
          id: member.id,
          userId: member.userId,
          name: user.name,
          email: user.email,
          role: member.role,
          avatarUrl: user.avatarUrl,
        }
      })
      .filter((m): m is Member => m !== null)

    return members
  }, [organizationMembers, users])
}
