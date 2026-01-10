import { useStore } from '@livestore/react'
import { tables } from '@sitelink/domain'
import { queryDb } from '@livestore/livestore'
import { useMemo } from 'react'
import { createAppStoreOptions } from '@/lib/store-config'
import { authClient } from '@/lib/auth'

export interface Sheet {
  id: string
  projectId: string
  planId: string
  number: string
  title: string
  discipline: string
  imagePath: string
  width: number
  height: number
  sortOrder: number
}

export interface SheetFolder {
  id: string
  name: string
  sheets: Sheet[]
}

export function useSheets(projectId: string) {
  const { data } = authClient.useSession()
  const sessionToken = data?.session?.token

  const storeOptions = useMemo(
    () => createAppStoreOptions(sessionToken),
    [sessionToken]
  )

  const store = useStore(storeOptions)

  const sheets = store?.useQuery(
    queryDb(
      tables.sheets
        .where({ projectId })
        .orderBy('sortOrder', 'asc')
    )
  )

  return useMemo(() => {
    const sheetsArray = Array.isArray(sheets) ? sheets : []

    const groupedByDiscipline: Record<string, Sheet[]> = {}

    sheetsArray.forEach(sheet => {
      const discipline = sheet.discipline || 'Unfiled sheets'

      if (!groupedByDiscipline[discipline]) {
        groupedByDiscipline[discipline] = []
      }

      groupedByDiscipline[discipline].push(sheet)
    })

    const folders: SheetFolder[] = Object.entries(groupedByDiscipline).map(([discipline, disciplineSheets]) => ({
      id: discipline.toLowerCase().replace(/\s+/g, '-'),
      name: discipline,
      sheets: disciplineSheets
    }))

    return folders
  }, [sheets])
}
