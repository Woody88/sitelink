import { useState, useCallback } from 'react'
import { View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { WorkspaceHeader } from '@/components/workspace/workspace-header'
import { WorkspaceTabs } from '@/components/workspace/workspace-tabs'
import { TabContent } from '@/components/workspace/tab-content'
import PlansScreen from './plans'
import CameraScreen from './camera'
import ActivityScreen from './activity'

const TABS = ['Plans', 'Camera', 'Activity']

export default function ProjectWorkspaceLayout() {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const params = useLocalSearchParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState(0)

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleNotifications = useCallback(() => {
    // TODO: Implement notifications screen (Phase 3 - sitelink-dbw)
    console.log('Notifications tapped')
  }, [])

  const handleSettings = useCallback(() => {
    // TODO: Implement settings screen (Phase 3 - sitelink-bb2)
    console.log('Settings tapped')
  }, [])

  // TODO: Get project name from LiveStore query using params.id
  const projectName = 'Riverside Apartments'

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background">
        <WorkspaceHeader
          projectName={projectName}
          onBack={handleBack}
          onNotifications={handleNotifications}
          onSettings={handleSettings}
        />
        <WorkspaceTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <TabContent activeTab={activeTab}>
          <PlansScreen />
          <CameraScreen />
          <ActivityScreen />
        </TabContent>
      </View>
    </>
  )
}
