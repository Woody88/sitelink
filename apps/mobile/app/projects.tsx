import { CreateProjectModal } from '@/components/project/create-project-modal'
import type { Project } from '@/components/project/project-card'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'
import { Separator } from '@/components/ui/separator'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty'
import { useProject } from '@/context/project-context'
import { Stack, useRouter } from 'expo-router'
import { Bell, User, FolderOpen, ChevronRight, MapPin } from 'lucide-react-native'
import * as React from 'react'
import { View, ScrollView, Pressable, FlatList } from 'react-native'
import { cn } from '@/lib/utils'

// Mock data
const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Riverside Apartments',
    address: '123 Main St, Denver, CO',
    sheetCount: 47,
    photoCount: 84,
    memberCount: 5,
    updatedAt: '2h ago',
    status: 'active',
  },
  {
    id: '2',
    name: 'Downtown Office Remodel',
    address: '456 Market St, San Francisco, CA',
    sheetCount: 23,
    photoCount: 31,
    memberCount: 3,
    updatedAt: '1 day ago',
    status: 'active',
  },
  {
    id: '3',
    name: 'Sunset Villa',
    address: '789 Ocean Dr, Miami, FL',
    sheetCount: 12,
    photoCount: 156,
    memberCount: 8,
    updatedAt: '3 days ago',
    status: 'completed',
  },
  {
    id: '4',
    name: 'Highland Park Demo',
    sheetCount: 5,
    photoCount: 10,
    memberCount: 1,
    updatedAt: '1 week ago',
    status: 'archived',
  },
]

interface FilterChipProps {
  label: string
  isActive: boolean
  onPress: () => void
}

const FilterChip = React.memo(function FilterChip({ label, isActive, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'mr-2 items-center justify-center rounded-full px-5',
        isActive ? 'bg-foreground' : 'border-border border bg-transparent'
      )}
      style={{ height: 48, borderRadius: 24 }}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}`}>
      <Text
        className={cn(
          'text-sm font-medium',
          isActive ? 'text-background' : 'text-muted-foreground'
        )}>
        {label}
      </Text>
    </Pressable>
  )
})

// Project List Item - Wealthsimple style with separator
interface ProjectListItemProps {
  project: Project
  onPress: (project: Project) => void
  isLast?: boolean
}

const ProjectListItem = React.memo(function ProjectListItem({
  project,
  onPress,
  isLast = false,
}: ProjectListItemProps) {
  return (
    <>
      <Pressable
        onPress={() => onPress(project)}
        className="active:bg-muted/50 flex-row items-center px-4 py-4"
        style={{ minHeight: 64 }}>
        <View className="flex-1">
          <Text className="text-foreground text-base font-medium">{project.name}</Text>
          {project.address ? (
            <View className="mt-1 flex-row items-center">
              <Icon as={MapPin} className="text-muted-foreground mr-1 size-3" />
              <Text className="text-muted-foreground text-sm">{project.address}</Text>
            </View>
          ) : (
            <Text className="text-muted-foreground mt-0.5 text-sm">
              {project.sheetCount} sheets • {project.memberCount} members
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground text-xs">{project.updatedAt}</Text>
          <Icon as={ChevronRight} className="text-muted-foreground size-5" />
        </View>
      </Pressable>
      {!isLast && <Separator className="ml-4" />}
    </>
  )
})

export default function ProjectsScreen() {
  const router = useRouter()
  const { setActiveProjectId } = useProject()
  const [createModalVisible, setCreateModalVisible] = React.useState(false)
  const [activeFilter, setActiveFilter] = React.useState('all')

  const filteredProjects = React.useMemo(() => {
    if (activeFilter === 'all') return MOCK_PROJECTS
    return MOCK_PROJECTS.filter((p) => p.status === activeFilter)
  }, [activeFilter])

  const handleProjectPress = React.useCallback(
    (project: Project) => {
      setActiveProjectId(project.id)
      router.push(`/project/${project.id}/` as any)
    },
    [setActiveProjectId, router]
  )

  const handleNotifications = React.useCallback(() => {
    router.push('/notifications' as any)
  }, [router])

  const handleProfile = React.useCallback(() => {
    router.push('/settings' as any)
  }, [router])

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Projects',
          headerShown: true,
          headerTitleAlign: 'center',
          headerLeft: () => (
            <Pressable
              onPress={handleNotifications}
              className="ml-2 h-12 w-12 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Notifications">
              <Icon as={Bell} className="text-foreground size-6" />
              {/* TODO: Add badge for unread count */}
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handleProfile}
              className="mr-2 h-12 w-12 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Profile">
              <Icon as={User} className="text-foreground size-6" />
            </Pressable>
          ),
        }}
      />

      <View className="bg-background flex-1">
        {/* Horizontal Filter Chips - Wealthsimple Pattern */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-grow-0"
          contentContainerClassName="px-4 py-3">
          <FilterChip
            label="All"
            isActive={activeFilter === 'all'}
            onPress={() => setActiveFilter('all')}
          />
          <FilterChip
            label="Active"
            isActive={activeFilter === 'active'}
            onPress={() => setActiveFilter('active')}
          />
          <FilterChip
            label="Completed"
            isActive={activeFilter === 'completed'}
            onPress={() => setActiveFilter('completed')}
          />
          <FilterChip
            label="Archived"
            isActive={activeFilter === 'archived'}
            onPress={() => setActiveFilter('archived')}
          />
        </ScrollView>

        {/* Project List - Wealthsimple style with separators */}
        {filteredProjects.length > 0 ? (
          <FlatList
            data={filteredProjects}
            renderItem={({ item, index }) => (
              <ProjectListItem
                project={item}
                onPress={handleProjectPress}
                isLast={index === filteredProjects.length - 1}
              />
            )}
            keyExtractor={(item) => item.id}
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon as={FolderOpen} className="text-muted-foreground size-8" />
              </EmptyMedia>
              <EmptyTitle>No Projects Found</EmptyTitle>
              <EmptyDescription>
                No projects match the selected filter. Try a different filter or create a new
                project.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onPress={() => setCreateModalVisible(true)}>
                <Text className="text-primary-foreground font-medium">Create Project</Text>
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </View>

      <CreateProjectModal
        isVisible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={(data) => {
          console.log('Create project:', data)
          setCreateModalVisible(false)
        }}
      />
    </>
  )
}
