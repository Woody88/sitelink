import { useState, useCallback } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { WorkspaceHeader } from '@/components/workspace/workspace-header'
import { ProjectContext } from '@/components/workspace/project-context'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { CameraFAB } from '@/components/workspace/camera-fab'
import PlansScreen from './plans'
import ActivityScreen from './activity'

type ActiveView = 'plans' | 'activity'

export default function ProjectWorkspaceLayout() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const params = useLocalSearchParams<{ id: string }>()
  const [activeView, setActiveView] = useState<ActiveView>('plans')

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleMenu = useCallback(() => {
    // TODO: Implement menu actions
    console.log('Menu tapped')
  }, [])

  const handleCamera = useCallback(() => {
    // TODO: Navigate to camera screen
    console.log('Camera tapped')
  }, [])

  // TODO: Get project name and address from LiveStore query using params.id
  const projectName = 'Riverside Apartments'

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background">
        <WorkspaceHeader onBack={handleBack} onMenu={handleMenu}>
          <SegmentedControl
            options={['Plans', 'Activity']}
            selectedIndex={activeView === 'plans' ? 0 : 1}
            onIndexChange={(index) => setActiveView(index === 0 ? 'plans' : 'activity')}
          />
        </WorkspaceHeader>

        <ProjectContext
          projectName={projectName}
          address="123 Main St, Denver, CO"
        />

        {activeView === 'plans' ? <PlansScreen /> : <ActivityScreen />}

        <CameraFAB onPress={handleCamera} className="absolute bottom-4 right-4" />
      </View>
    </>
  )
}
