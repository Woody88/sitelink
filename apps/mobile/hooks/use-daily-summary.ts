import { useState, useCallback } from 'react'

export interface DailySummary {
  text: string
  lastGenerated: Date
}

export function useDailySummary(projectId: string) {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const generateSummary = useCallback(async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setSummary({
      text: "Work documented:\n• Electrical junction (5/A7): 7 photos\n  Note: Junction box needs repositioning ~6\" left\n• Panel rough-in (3/A2): 3 photos, in progress\n\n⚠️ Issues flagged: 1",
      lastGenerated: new Date()
    })
    setIsLoading(false)
  }, [projectId])

  return {
    summary,
    isLoading,
    generateSummary
  }
}


