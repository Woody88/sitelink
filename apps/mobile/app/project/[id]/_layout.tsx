import { useState, useCallback } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter, useSegments, Slot } from 'expo-router'
import { WorkspaceHeader } from '@/components/workspace/workspace-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { WorkspaceFAB } from '@/components/workspace/camera-fab'
import { Plus, Camera } from 'lucide-react-native'
import { UploadPlanSheet } from '@/components/plans/upload-plan-sheet'
import PlansScreen from './plans'
import ActivityScreen from './activity'
import MediaScreen from './media'

type ActiveView = 'plans' | 'media' | 'activity'

export default function ProjectWorkspaceLayout() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const params = useLocalSearchParams<{ id: string }>()
  const segments = useSegments()
  const [activeView, setActiveView] = useState<ActiveView>('plans')
  const [isUploadSheetVisible, setIsUploadSheetVisible] = useState(false)
  
  // Check if we're on the camera route
  const isCameraRoute = segments[segments.length - 1] === 'camera'

  // Expose setActiveView to child components via context or prop drilling
  // For now, we'll handle it in the layout

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleMenu = useCallback(() => {
    // TODO: Implement menu actions
    console.log('Menu tapped')
  }, [])

  const handleFABPress = useCallback(() => {
    if (activeView === 'plans') {
      setIsUploadSheetVisible(true)
    } else {
      router.push(`/project/${params.id}/camera` as any)
    }
  }, [activeView, router, params.id])

  const handleUploadFromDevice = useCallback(() => {
    // TODO: Open document picker
    console.log('Open document picker')
  }, [])

  const getFABIcon = () => {
    if (activeView === 'plans') return Plus
    return Camera
  }

  // TODO: Get project name and address from LiveStore query using params.id
  const projectName = 'Riverside Apartments'

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
          address="123 Main St, Denver, CO"
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
