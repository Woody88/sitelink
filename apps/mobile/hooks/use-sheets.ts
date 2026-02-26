import { queryDb } from '@livestore/livestore'
import { tables } from '@sitelink/domain'
import { useMemo } from 'react'
import { useSessionContext } from '@/lib/session-context'
import { useAppStore } from '@/livestore/store'

const BACKEND_URL = process.env.EXPO_PUBLIC_BETTER_AUTH_URL

export interface Sheet {
  id: string
  projectId: string
  planId: string
  planName: string
  number: string
  title: string
  discipline: string
  imagePath: string
  width: number
  height: number
  sortOrder: number
  processingStage?: string | null
  localPmtilesPath?: string | null
  remotePmtilesPath?: string | null
  minZoom?: number | null
  maxZoom?: number | null
}

export type PlanStatus = 'uploaded' | 'processing' | 'completed' | 'failed'

export interface SheetFolder {
  id: string
  planId: string
  name: string
  sheets: Sheet[]
  status: PlanStatus
  processingProgress: number | null
}

export function useSheets(projectId: string) {
  const { sessionToken, organizationId, sessionId } = useSessionContext()

  const store = useAppStore(organizationId!, sessionToken, sessionId)

  const sheets = store.useQuery(
    queryDb(tables.sheets.where({ projectId }).orderBy('sortOrder', 'asc'))
  )

  const plans = store.useQuery(queryDb(tables.plans.where({ projectId })))

  return useMemo(() => {
    const sheetsArray = Array.isArray(sheets) ? sheets : []
    const plansArray = Array.isArray(plans) ? plans : []

    const planStatusMap = new Map<string, { status: PlanStatus; progress: number | null }>()
    const planNameMap = new Map<string, string>()
    plansArray.forEach((plan) => {
      planStatusMap.set(plan.id, {
        status: plan.status as PlanStatus,
        progress: plan.processingProgress,
      })
      if (plan.fileName) {
        planNameMap.set(plan.id, plan.fileName.replace(/\.pdf$/i, ''))
      }
    })

    const groupedByPlan: Record<string, { planId: string; planName: string; sheets: Sheet[] }> = {}

    sheetsArray.forEach((sheet) => {
      const planName = planNameMap.get(sheet.planId) || sheet.planName || 'Unfiled sheets'
      const planId = sheet.planId

      if (!groupedByPlan[planId]) {
        groupedByPlan[planId] = { planId, planName, sheets: [] }
      }

      // Transform imagePath to full URL
      const transformedSheet = {
        ...sheet,
        imagePath: sheet.imagePath?.startsWith('/api/')
          ? `${BACKEND_URL}${sheet.imagePath}`
          : sheet.imagePath,
      }

      groupedByPlan[planId].sheets.push(transformedSheet)
    })

    const folders: SheetFolder[] = Object.values(groupedByPlan).map(
      ({ planId, planName, sheets: planSheets }) => {
        const planInfo = planStatusMap.get(planId)
        return {
          id: planName.toLowerCase().replace(/\s+/g, '-'),
          planId,
          name: planName,
          sheets: planSheets,
          status: planInfo?.status ?? 'completed',
          processingProgress: planInfo?.progress ?? null,
        }
      }
    )

    return folders
  }, [sheets, plans])
}
