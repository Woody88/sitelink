import type { Meta, StoryObj } from "@storybook/react"
import {
  ArrowLeft,
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  MapPin,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react-native"
import * as React from "react"
import { FlatList, Image, Pressable, ScrollView, View } from "react-native"
import {
  CreateProjectOverlay,
  ProcessingBanner,
  ProcessingOverlay,
  StorySegmentedControl,
  StoryToast,
  UploadPlanOverlay,
  useProcessingState,
} from "@/app/_story-components"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  name: string
  address?: string
  sheetCount: number
  photoCount: number
  memberCount: number
  updatedAt: string
  status: "active" | "archived" | "completed"
}

const MOCK_PROJECTS: Project[] = [
  {
    id: "1",
    name: "Holabird Ave Warehouse",
    address: "4200 Holabird Ave, Baltimore, MD",
    sheetCount: 12,
    photoCount: 48,
    memberCount: 5,
    updatedAt: "2h ago",
    status: "active",
  },
  {
    id: "2",
    name: "Riverside Office Park",
    address: "1500 Riverside Dr, Austin, TX",
    sheetCount: 8,
    photoCount: 23,
    memberCount: 3,
    updatedAt: "1d ago",
    status: "active",
  },
  {
    id: "3",
    name: "Harbor Point Phase II",
    address: "1 Harbor Point Rd, Baltimore, MD",
    sheetCount: 24,
    photoCount: 156,
    memberCount: 8,
    updatedAt: "3d ago",
    status: "active",
  },
  {
    id: "4",
    name: "Summit Ridge Residential",
    address: "700 Summit Ridge Blvd, Denver, CO",
    sheetCount: 6,
    photoCount: 12,
    memberCount: 2,
    updatedAt: "1w ago",
    status: "completed",
  },
]

const MOCK_FOLDERS = [
  {
    id: "f1",
    name: "Structural Plans",
    sheets: [
      { id: "s1", number: "S1.0", title: "Foundation Plan" },
      { id: "s2", number: "S2.0", title: "Second Floor Framing" },
      { id: "s3", number: "S3.0", title: "Slab on Grade Schedule" },
      { id: "s4", number: "S4.0", title: "Roof Framing Plan" },
    ],
  },
  {
    id: "f2",
    name: "Architectural Plans",
    sheets: [
      { id: "a1", number: "A1.0", title: "Site Plan" },
      { id: "a2", number: "A2.0", title: "Floor Plan - Level 1" },
      { id: "a3", number: "A3.0", title: "Floor Plan - Level 2" },
    ],
  },
  {
    id: "f3",
    name: "Electrical Plans",
    sheets: [
      { id: "e1", number: "E1.0", title: "Lighting Plan" },
      { id: "e2", number: "E2.0", title: "Power Plan" },
    ],
  },
]

function FilterChip({
  label,
  isActive,
  onPress,
}: {
  label: string
  isActive: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        "mr-2 items-center justify-center rounded-full px-4",
        isActive ? "bg-foreground" : "bg-muted",
      )}
      style={{ height: 32, borderRadius: 16 }}
    >
      <Text
        className={cn(
          "text-xs font-medium",
          isActive ? "text-background" : "text-muted-foreground",
        )}
      >
        {label}
      </Text>
    </Pressable>
  )
}

function ProjectListItem({
  project,
  isLast,
  onPress,
}: {
  project: Project
  isLast?: boolean
  onPress?: () => void
}) {
  const todayActivity = project.id === "1" ? { photos: 12, issues: 1 } : null
  return (
    <>
      <Pressable
        onPress={onPress}
        className="active:bg-muted/50 px-4 py-5"
        style={{ minHeight: 80 }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-foreground text-lg leading-tight font-semibold">
              {project.name}
            </Text>
            <Text className="text-muted-foreground mt-1 text-sm">
              {project.sheetCount} sheets • {project.photoCount} photos • {project.memberCount}{" "}
              members
            </Text>
            {project.address && (
              <View className="mt-1 flex-row items-center">
                <Icon as={MapPin} className="text-muted-foreground mr-1 size-3" />
                <Text className="text-muted-foreground text-xs">{project.address}</Text>
              </View>
            )}
          </View>
          <Text className="text-muted-foreground text-xs">{project.updatedAt}</Text>
        </View>
        {todayActivity && (
          <View className="border-border/50 mt-4 flex-row items-center border-t pt-4">
            <View className="mr-2 size-2 rounded-full bg-blue-500" />
            <Text className="text-foreground/80 text-xs font-medium">
              Today: {todayActivity.photos} photos
              {todayActivity.issues > 0 ? `, ${todayActivity.issues} issue flagged` : ""}
            </Text>
          </View>
        )}
      </Pressable>
      {!isLast && (
        <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }} className="ml-4" />
      )}
    </>
  )
}

function PlansTab() {
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")
  const [expandedFolders, setExpandedFolders] = React.useState<string[]>(["f1"])
  const toggleFolder = (id: string) =>
    setExpandedFolders((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))

  return (
    <View className="flex-1">
      <View className="px-4 py-4">
        <View className="flex-row items-center gap-2">
          <View className="relative flex-1">
            <View className="absolute top-2.5 left-3 z-10">
              <Icon as={Search} className="text-muted-foreground size-4" />
            </View>
            <Input
              placeholder="Search plans"
              className="bg-muted/40 h-10 rounded-xl border-transparent pl-10"
            />
          </View>
          <View className="bg-muted/20 flex-row rounded-xl p-1">
            <Pressable
              onPress={() => setViewMode("grid")}
              className={cn(
                "rounded-lg p-1.5",
                viewMode === "grid" ? "bg-background shadow-sm" : "bg-transparent",
              )}
            >
              <Icon
                as={LayoutGrid}
                className={cn(
                  "size-4",
                  viewMode === "grid" ? "text-foreground" : "text-muted-foreground",
                )}
              />
            </Pressable>
            <Pressable
              onPress={() => setViewMode("list")}
              className={cn(
                "rounded-lg p-1.5",
                viewMode === "list" ? "bg-background shadow-sm" : "bg-transparent",
              )}
            >
              <Icon
                as={List}
                className={cn(
                  "size-4",
                  viewMode === "list" ? "text-foreground" : "text-muted-foreground",
                )}
              />
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {MOCK_FOLDERS.map((folder) => (
          <Collapsible
            key={folder.id}
            open={expandedFolders.includes(folder.id)}
            onOpenChange={() => toggleFolder(folder.id)}
            className="mb-4"
          >
            <CollapsibleTrigger asChild>
              <Pressable className="bg-muted/10 flex-row items-center justify-between rounded-xl px-4 py-3">
                <View className="flex-1 flex-row items-center gap-3">
                  <Icon as={Folder} className="text-muted-foreground size-5" />
                  <View className="flex-1">
                    <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
                      {folder.name}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {folder.sheets.length} plans
                    </Text>
                  </View>
                </View>
                <Icon
                  as={expandedFolders.includes(folder.id) ? ChevronDown : ChevronRight}
                  className="text-muted-foreground size-5"
                />
              </Pressable>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {viewMode === "grid" ? (
                <View className="pt-2" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {folder.sheets.map((sheet) => (
                    <Pressable
                      key={sheet.id}
                      className="border-border active:bg-muted/10 overflow-hidden rounded-2xl border"
                      style={{ width: "48%" }}
                    >
                      <Image
                        source={{ uri: "/plan-sample.png" }}
                        style={{ width: "100%", aspectRatio: 3 / 2 }}
                        resizeMode="cover"
                      />
                      <View className="p-3">
                        <Text className="text-foreground text-sm font-bold">{sheet.number}</Text>
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                          {sheet.title}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View className="gap-1 pt-2">
                  {folder.sheets.map((sheet) => (
                    <Pressable
                      key={sheet.id}
                      className="active:bg-muted/10 flex-row items-center gap-4 rounded-lg px-2 py-3"
                    >
                      <View className="bg-muted/20 size-10 items-center justify-center rounded-lg">
                        <Icon as={FileText} className="text-muted-foreground size-5" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-base font-bold">{sheet.number}</Text>
                        <Text className="text-muted-foreground text-sm">{sheet.title}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </ScrollView>
    </View>
  )
}

type FlowScreen = "projects" | "create" | "workspace"

function ProjectManagementFlow({
  initialScreen = "projects" as FlowScreen,
}: {
  initialScreen?: FlowScreen
}) {
  const [screen, setScreen] = React.useState<FlowScreen>(initialScreen)
  const [activeFilter, setActiveFilter] = React.useState("all")
  const [showCreateModal, setShowCreateModal] = React.useState(initialScreen === "create")
  const [showUploadModal, setShowUploadModal] = React.useState(false)
  const [selectedProject, setSelectedProject] = React.useState<Project | null>(
    initialScreen === "workspace" ? MOCK_PROJECTS[0] : null,
  )
  const [activeTab, setActiveTab] = React.useState(0)
  const processing = useProcessingState()
  const [showProcessingOverlay, setShowProcessingOverlay] = React.useState(false)
  const [toastMsg, setToastMsg] = React.useState("")

  const filteredProjects = React.useMemo(() => {
    if (activeFilter === "all") return MOCK_PROJECTS
    return MOCK_PROJECTS.filter((p) => p.status === activeFilter)
  }, [activeFilter])

  if (screen === "workspace" && selectedProject) {
    return (
      <View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
        <View className="bg-background" style={{ paddingTop: 8 }}>
          <View className="min-h-[56px] flex-row items-center justify-between px-4">
            <Pressable
              onPress={() => {
                setScreen("projects")
                setSelectedProject(null)
              }}
              className="-ml-1 items-center justify-center"
              style={{ width: 44, height: 44 }}
            >
              <Icon as={ArrowLeft} className="text-foreground size-6" />
            </Pressable>
            <View className="flex-1 items-center justify-center px-2">
              <Text
                className="text-foreground text-center text-base leading-tight font-bold"
                numberOfLines={1}
              >
                {selectedProject.name}
              </Text>
              {selectedProject.address && (
                <Text className="text-muted-foreground mt-0.5 text-center text-[11px] leading-snug">
                  {selectedProject.address}
                </Text>
              )}
            </View>
            <Pressable
              className="-mr-1 items-center justify-center"
              style={{ width: 44, height: 44 }}
            >
              <Icon as={Settings} className="text-foreground size-5" />
            </Pressable>
          </View>
          <View className="items-center pt-3 pb-4">
            <StorySegmentedControl
              options={["Plans", "Media", "Activity"]}
              selectedIndex={activeTab}
              onIndexChange={setActiveTab}
            />
          </View>
        </View>
        {activeTab === 0 && (
          <>
            {processing.isProcessing && !showProcessingOverlay && (
              <ProcessingBanner
                stageIndex={processing.stageIndex}
                onPress={() => setShowProcessingOverlay(true)}
              />
            )}
            <PlansTab />
          </>
        )}
        {activeTab === 1 && (
          <Empty className="mx-4 mb-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon as={Camera} className="text-muted-foreground size-8" />
              </EmptyMedia>
              <EmptyTitle>No Media Yet</EmptyTitle>
              <EmptyDescription>
                Photos and recordings from this project will appear here as they are captured.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {activeTab === 2 && (
          <View className="items-center px-4 pt-20">
            <Text className="text-muted-foreground text-sm">Activity feed coming soon</Text>
          </View>
        )}
        {activeTab !== 2 && (
          <View
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              width: 56,
              height: 56,
              zIndex: 50,
            }}
          >
            <Pressable
              onPress={() => {
                if (activeTab === 0) setShowUploadModal(true)
              }}
              className="bg-primary h-14 w-14 items-center justify-center rounded-full"
            >
              <Icon
                as={activeTab === 0 ? Plus : Camera}
                className="text-primary-foreground size-6"
                strokeWidth={2.5}
              />
            </Pressable>
          </View>
        )}
        {showUploadModal && (
          <UploadPlanOverlay
            onClose={() => setShowUploadModal(false)}
            onDeviceStorage={() => {
              setShowUploadModal(false)
              processing.start()
              setShowProcessingOverlay(true)
            }}
          />
        )}
        {showProcessingOverlay && processing.isProcessing && (
          <ProcessingOverlay
            onClose={() => setShowProcessingOverlay(false)}
            stageIndex={processing.stageIndex}
          />
        )}
        <StoryToast message={toastMsg} visible={!!toastMsg} onDismiss={() => setToastMsg("")} />
      </View>
    )
  }

  return (
    <View className="bg-background" style={{ minHeight: "100vh", position: "relative" } as any}>
      <View className="border-border flex-row items-center justify-between border-b px-4 py-3">
        <Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
          <Icon as={Bell} className="text-foreground size-6" />
        </Pressable>
        <Text className="text-foreground text-lg font-bold">Projects</Text>
        <Pressable className="items-center justify-center" style={{ width: 44, height: 44 }}>
          <Icon as={Moon} className="text-foreground size-6" />
        </Pressable>
      </View>
      <View className="px-4 py-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2"
        >
          {["all", "active", "completed", "archived"].map((f) => (
            <FilterChip
              key={f}
              label={f.charAt(0).toUpperCase() + f.slice(1)}
              isActive={activeFilter === f}
              onPress={() => setActiveFilter(f)}
            />
          ))}
        </ScrollView>
      </View>
      {filteredProjects.length > 0 ? (
        <FlatList
          data={filteredProjects}
          renderItem={({ item, index }) => (
            <ProjectListItem
              project={item}
              isLast={index === filteredProjects.length - 1}
              onPress={() => {
                setSelectedProject(item)
                setScreen("workspace")
              }}
            />
          )}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
        />
      ) : (
        <Empty className="mx-4 mb-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Icon as={FolderOpen} className="text-muted-foreground size-8" />
            </EmptyMedia>
            <EmptyTitle>No Projects Found</EmptyTitle>
            <EmptyDescription>
              No {activeFilter} projects. Try a different filter or create a new project.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button className="h-12 rounded-xl px-8" onPress={() => setShowCreateModal(true)}>
              <Text className="text-primary-foreground text-base font-bold">Create Project</Text>
            </Button>
          </EmptyContent>
        </Empty>
      )}
      <View
        style={{ position: "absolute", bottom: 16, right: 16, width: 56, height: 56, zIndex: 50 }}
      >
        <Pressable
          onPress={() => setShowCreateModal(true)}
          className="bg-primary h-14 w-14 items-center justify-center rounded-full"
        >
          <Icon as={Plus} className="text-primary-foreground size-6" strokeWidth={2.5} />
        </Pressable>
      </View>
      {showCreateModal && (
        <CreateProjectOverlay
          onClose={() => setShowCreateModal(false)}
          onCreated={(data) => {
            setShowCreateModal(false)
            setSelectedProject({
              id: `new-${Date.now()}`,
              name: data.name,
              address: data.address,
              sheetCount: 0,
              photoCount: 0,
              memberCount: 1,
              updatedAt: "Just now",
              status: "active",
            })
            setScreen("workspace")
          }}
        />
      )}
    </View>
  )
}

const meta: Meta<typeof ProjectManagementFlow> = {
  title: "Flows/8. Project Management",
  component: ProjectManagementFlow,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof ProjectManagementFlow>

export const ProjectsList: Story = { name: "1. Projects List", args: { initialScreen: "projects" } }
export const CreateProject: Story = { name: "2. Create Project", args: { initialScreen: "create" } }
export const Workspace: Story = {
  name: "3. Project Workspace",
  args: { initialScreen: "workspace" },
}
export const FullFlow: Story = { name: "Full Flow", args: { initialScreen: "projects" } }
