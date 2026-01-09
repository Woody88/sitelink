import { useState, useCallback, useMemo } from 'react'
import { View, Alert } from 'react-native'
import { Stack, useLocalSearchParams, useRouter, useSegments, Slot } from 'expo-router'
import { WorkspaceHeader } from '@/components/workspace/workspace-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { WorkspaceFAB } from '@/components/workspace/camera-fab'
import { Plus, Camera } from 'lucide-react-native'
import { UploadPlanSheet } from '@/components/plans/upload-plan-sheet'
import { usePlanUpload } from '@/hooks/use-plan-upload'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@livestore/react'
import { queryDb } from '@livestore/livestore'
import { tables } from '@sitelink/domain'
import { createAppStoreOptions } from '@/lib/store-config'
import { authClient } from '@/lib/auth'
import PlansScreen from './plans'
import ActivityScreen from './activity'
import MediaScreen from './media'

type ActiveView = 'plans' | 'media' | 'activity'

export default function ProjectWorkspaceLayout() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const segments = useSegments()
  const [activeView, setActiveView] = useState<ActiveView>('plans')
  const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false)

  const { user } = useAuth()
  const { data: sessionData } = authClient.useSession()
  const sessionToken = sessionData?.session?.token

  const storeOptions = useMemo(() => {
    if (!sessionToken) {
      return createAppStoreOptions('')
    }
    return createAppStoreOptions(sessionToken)
  }, [sessionToken])

  const store = useStore(storeOptions)

  const projectQuery = useMemo(
    () => queryDb(tables.projects.where({ id: params.id })),
    [params.id]
  )

  const project = store.useQuery(projectQuery)

  const projectData = Array.isArray(project) ? project[0] : null
  const organizationId = projectData?.organizationId || 'default-org'
  const uploadedBy = user?.id || 'anonymous'

  const { pickAndUploadPlan } = usePlanUpload({
    projectId: params.id,
    organizationId,
    uploadedBy,
  })

  const isCameraRoute = segments[segments.length - 1] === 'camera'

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleMenu = useCallback(() => {
    router.push(`/project/${params.id}/settings` as any)
  }, [router, params.id])

  const handleFABPress = useCallback(() => {
    if (activeView === 'plans') {
      setIsUploadSheetVisible(true)
    } else {
      router.push(`/project/${params.id}/camera` as any)
    }
  }, [activeView, router, params.id])

  const handleUploadFromDevice = useCallback(async () => {
    try {
      setIsUploadSheetVisible(false)

      await pickAndUploadPlan()

      Alert.alert(
        'Success',
        'Plan uploaded and processed successfully',
        [{ text: 'OK' }]
      )
    } catch (error) {
      console.error('[UPLOAD] Error uploading plan:', error)
      Alert.alert(
        'Error',
        'Failed to upload and process plan. Please try again.',
        [{ text: 'OK' }]
      )
    }
  }, [pickAndUploadPlan])

  const getFABIcon = () => {
    if (activeView === 'plans') return Plus
    return Camera
  }

  const projectName = projectData?.name || 'Loading...'
  const projectAddress = projectData?.address || undefined

  // If we're on the camera route, let it render directly
  if (isCameraRoute) {
    return <Slot />
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background">
        <WorkspaceHeader
          onBack={handleBack}
          onMenu={handleMenu}
          projectName={projectName}
          address={projectAddress}
        >
          <SegmentedControl
            options={['Plans', 'Media', 'Activity']}
            selectedIndex={activeView === 'plans' ? 0 : activeView === 'media' ? 1 : 2}
            onIndexChange={(index) => {
              if (index === 0) setActiveView('plans')
              else if (index === 1) setActiveView('media')
              else setActiveView('activity')
            }}
          />
        </WorkspaceHeader>

        {activeView === 'plans' && <PlansScreen />}
        {activeView === 'media' && <MediaScreen />}
        {activeView === 'activity' && <ActivityScreen />}

        <WorkspaceFAB 
          onPress={handleFABPress} 
          icon={getFABIcon()}
        />

        <UploadPlanSheet
          isVisible={isUploadSheetVisible}
          onClose={() => setIsUploadSheetVisible(false)}
          onUploadFromDevice={handleUploadFromDevice}
        />
      </View>
    </>
  )
}
