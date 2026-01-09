import { useState, useCallback } from 'react'
import { View, Alert } from 'react-native'
import { Stack, useLocalSearchParams, useRouter, useSegments, Slot } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { WorkspaceHeader } from '@/components/workspace/workspace-header'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { WorkspaceFAB } from '@/components/workspace/camera-fab'
import { Plus, Camera } from 'lucide-react-native'
import { UploadPlanSheet } from '@/components/plans/upload-plan-sheet'
import { ensurePlanUploadDirectoryExists } from '@/utils/file-paths'
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
  
  // Check if we're on the camera route
  const isCameraRoute = segments[segments.length - 1] === 'camera'

  // Expose setActiveView to child components via context or prop drilling
  // For now, we'll handle it in the layout

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
      // Open document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      })

      if (result.canceled) {
        return
      }

      const file = result.assets[0]
      
      // TODO: Get organizationId from user context or project data
      // For now, using placeholder - this should come from LiveStore query
      const organizationId = 'temp-org-id' // TODO: Replace with actual organizationId
      const projectId = params.id
      
      // Generate upload ID
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`
      
      // Ensure directory exists
      const uploadPath = await ensurePlanUploadDirectoryExists(organizationId, projectId, uploadId)
      
      // Get file extension
      const fileExtension = file.name.split('.').pop() || ''
      const fileName = `plan.${fileExtension}`
      const destinationPath = `${uploadPath}/${fileName}`
      
      // Copy file to destination
      await FileSystem.copyAsync({
        from: file.uri,
        to: destinationPath,
      })

      console.log('[UPLOAD] Plan saved to:', destinationPath)
      
      // TODO: Save metadata to SQLite
      // await savePlanMetadata({
      //   id: uploadId,
      //   projectId,
      //   organizationId,
      //   fileName: file.name,
      //   fileSize: file.size,
      //   mimeType: file.mimeType || 'application/pdf',
      //   remotePath: destinationPath,
      //   status: 'uploaded',
      //   uploadedBy: userId,
      //   uploadedAt: Date.now(),
      // })

      Alert.alert('Success', 'Plan uploaded successfully')
    } catch (error) {
      console.error('[UPLOAD] Error uploading plan:', error)
      Alert.alert('Error', 'Failed to upload plan. Please try again.')
    }
  }, [params.id])

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
