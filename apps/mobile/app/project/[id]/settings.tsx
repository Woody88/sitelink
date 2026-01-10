// apps/mobile/app/project/[id]/settings.tsx
import * as React from 'react'
import { ScrollView, View, Alert } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'
import { SettingsItem } from '@/components/settings/settings-item'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  FileText,
  HardDrive,
  Bell,
  Users,
  Edit,
  Download,
} from 'lucide-react-native'
import { Icon } from '@/components/ui/icon'
import * as FileSystem from 'expo-file-system/legacy'
import { getMediaPath, getProjectPath } from '@/utils/file-paths'

export default function ProjectSettingsScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  
  // TODO: Get project data from LiveStore
  const [projectName] = React.useState('Riverside Apartments')
  const [projectAddress] = React.useState('123 Main St, Denver, CO')
  const [isEditingDetails, setIsEditingDetails] = React.useState(false)
  
  // Notification settings
  const [notifyOnNewPlans, setNotifyOnNewPlans] = React.useState(true)
  const [notifyOnNewMedia, setNotifyOnNewMedia] = React.useState(true)
  const [notifyOnComments, setNotifyOnComments] = React.useState(true)
  
  // Storage info (mock for now)
  const [storageInfo, setStorageInfo] = React.useState({
    totalSize: 0,
    plansSize: 0,
    mediaSize: 0,
    plansCount: 0,
    mediaCount: 0,
  })

  // Calculate storage info
  React.useEffect(() => {
    const calculateStorage = async () => {
      try {
        // TODO: Get organizationId from user context or project data
        const organizationId = 'temp-org-id'
        const projectId = params.id
        
        const projectPath = getProjectPath(organizationId, projectId)
        const mediaPath = getMediaPath(organizationId, projectId)
        
        // Calculate plans directory size (all plan upload directories)
        let plansSize = 0
        let plansCount = 0
        try {
          const projectInfo = await FileSystem.getInfoAsync(projectPath)
          if (projectInfo.exists && projectInfo.isDirectory) {
            const planDir = `${projectPath}/plan`
            const planDirInfo = await FileSystem.getInfoAsync(planDir)
            if (planDirInfo.exists && planDirInfo.isDirectory) {
              // TODO: Iterate through upload directories and calculate size
              // For now, using placeholder
              plansSize = 0
              plansCount = 0
            }
          }
        } catch (error) {
          console.error('Error calculating plans storage:', error)
        }
        
        // Calculate media directory size
        let mediaSize = 0
        let mediaCount = 0
        try {
          const mediaInfo = await FileSystem.getInfoAsync(mediaPath)
          if (mediaInfo.exists && mediaInfo.isDirectory) {
            // TODO: Iterate through files and calculate size
            // For now, using placeholder
            mediaSize = 0
            mediaCount = 0
          }
        } catch (error) {
          console.error('Error calculating media storage:', error)
        }
        
        setStorageInfo({
          totalSize: plansSize + mediaSize,
          plansSize,
          mediaSize,
          plansCount,
          mediaCount,
        })
      } catch (error) {
        console.error('Error calculating storage:', error)
      }
    }
    
    calculateStorage()
  }, [params.id])

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const handleSaveDetails = () => {
    // TODO: Save project details to LiveStore
    setIsEditingDetails(false)
    Alert.alert('Success', 'Project details updated')
  }

  const handleDownloadAllData = () => {
    Alert.alert(
      'Download All Data',
      'This will prepare a download of all project data including plans and media. This feature will be available soon.',
      [{ text: 'OK' }]
    )
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Project Settings',
          headerShown: true,
          headerTitleAlign: 'center',
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Details Section */}
        <View className="px-4 pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Details
          </Text>
          <View className="bg-card rounded-2xl overflow-hidden border border-border/50">
            {isEditingDetails ? (
              <View className="p-4 gap-4">
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Project Name</Text>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1">
                      <Text className="text-base">{projectName}</Text>
                    </View>
                    <SettingsItem
                      icon={Edit}
                      label="Edit"
                      onPress={() => {
                        // TODO: Open edit modal or navigate to edit screen
                        Alert.alert('Edit', 'Edit functionality coming soon')
                      }}
                      className="p-0"
                    />
                  </View>
                </View>
                <Separator />
                <View className="gap-2">
                  <Text className="text-sm font-medium text-foreground">Address</Text>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1">
                      <Text className="text-base">{projectAddress}</Text>
                    </View>
                    <SettingsItem
                      icon={Edit}
                      label="Edit"
                      onPress={() => {
                        // TODO: Open edit modal or navigate to edit screen
                        Alert.alert('Edit', 'Edit functionality coming soon')
                      }}
                      className="p-0"
                    />
                  </View>
                </View>
                <View className="flex-row gap-2 mt-2">
                  <View className="flex-1">
                    <SettingsItem
                      label="Cancel"
                      onPress={() => setIsEditingDetails(false)}
                      className="p-0"
                    />
                  </View>
                  <View className="flex-1">
                    <SettingsItem
                      label="Save"
                      onPress={handleSaveDetails}
                      className="p-0"
                    />
                  </View>
                </View>
              </View>
            ) : (
              <>
                <SettingsItem
                  icon={FileText}
                  label="Project Name"
                  value={projectName}
                  onPress={() => setIsEditingDetails(true)}
                />
                <Separator />
                <SettingsItem
                  icon={FileText}
                  label="Address"
                  value={projectAddress}
                  onPress={() => setIsEditingDetails(true)}
                />
              </>
            )}
          </View>
        </View>

        {/* Storage Section */}
        <View className="px-4 pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Storage
          </Text>
          <View className="bg-card rounded-2xl overflow-hidden border border-border/50">
            <SettingsItem
              icon={HardDrive}
              label="Total Storage"
              value={formatBytes(storageInfo.totalSize)}
            />
            <Separator />
            <SettingsItem
              icon={FileText}
              label="Plans"
              value={`${formatBytes(storageInfo.plansSize)} • ${storageInfo.plansCount} files`}
            />
            <Separator />
            <SettingsItem
              icon={FileText}
              label="Media"
              value={`${formatBytes(storageInfo.mediaSize)} • ${storageInfo.mediaCount} files`}
            />
            <Separator />
            <SettingsItem
              icon={Download}
              label="Download All Data"
              onPress={handleDownloadAllData}
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View className="px-4 pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Notifications
          </Text>
          <View className="bg-card rounded-2xl overflow-hidden border border-border/50">
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="size-8 items-center justify-center rounded-full bg-muted">
                  <Icon as={FileText} className="size-4 text-foreground" />
                </View>
                <Text className="text-base font-medium">New Plans</Text>
              </View>
              <Switch
                checked={notifyOnNewPlans}
                onCheckedChange={setNotifyOnNewPlans}
              />
            </View>
            <Separator />
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="size-8 items-center justify-center rounded-full bg-muted">
                  <Icon as={FileText} className="size-4 text-foreground" />
                </View>
                <Text className="text-base font-medium">New Media</Text>
              </View>
              <Switch
                checked={notifyOnNewMedia}
                onCheckedChange={setNotifyOnNewMedia}
              />
            </View>
            <Separator />
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="size-8 items-center justify-center rounded-full bg-muted">
                  <Icon as={Bell} className="size-4 text-foreground" />
                </View>
                <Text className="text-base font-medium">Comments</Text>
              </View>
              <Switch
                checked={notifyOnComments}
                onCheckedChange={setNotifyOnComments}
              />
            </View>
          </View>
        </View>

        {/* Members Section */}
        <View className="px-4 pt-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Team
          </Text>
          <View className="bg-card rounded-2xl overflow-hidden border border-border/50">
            <SettingsItem
              icon={Users}
              label="Team Members"
              onPress={() => router.push(`/project/${params.id}/members` as any)}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

