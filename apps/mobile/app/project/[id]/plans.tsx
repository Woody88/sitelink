import * as React from 'react'
import { View, ScrollView, Pressable, Image, Modal, ActivityIndicator } from 'react-native'
import { Text } from '@/components/ui/text'
import { Input } from '@/components/ui/input'
import { Icon } from '@/components/ui/icon'
import {
  Search,
  LayoutGrid,
  List,
  Folder,
  ChevronDown,
  ChevronRight,
  FileText,
  Maximize2
} from 'lucide-react-native'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams } from 'expo-router'

import { PlanSelector, Plan } from '@/components/plans/plan-selector'
import { PlanViewer } from '@/components/plans/viewer'
import { useSheets, Sheet } from '@/hooks/use-sheets'

export default function PlansScreen() {
  const { id: projectId } = useLocalSearchParams<{ id: string }>()
  const folders = useSheets(projectId!)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('list')
  const [expandedFolders, setExpandedFolders] = React.useState<string[]>([])
  const [isSelectorVisible, setIsSelectorVisible] = React.useState(false)
  const [selectedPlan, setSelectedPlan] = React.useState<Plan | null>(null)
  const [isViewerVisible, setIsViewerVisible] = React.useState(false)

  React.useEffect(() => {
    if (folders.length > 0 && expandedFolders.length === 0) {
      setExpandedFolders([folders[0].id])
    }
  }, [folders, expandedFolders.length])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => 
      prev.includes(folderId) 
        ? prev.filter(id => id !== folderId) 
        : [...prev, folderId]
    )
  }

  const handleSelectPlan = (plan: Plan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedPlan(plan)
    setIsSelectorVisible(false)
    setIsViewerVisible(true)
  }

  const handleOpenPlan = React.useCallback((plan: Plan) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedPlan(plan)
    setIsViewerVisible(true)
  }, [])

  const handleCloseViewer = React.useCallback(() => {
    setIsViewerVisible(false)
    setSelectedPlan(null)
  }, [])

  const handleSheetChange = React.useCallback((sheetRef: string) => {
    const allPlans = folders.flatMap(f => f.sheets.map(s => sheetToplan(s)))
    const plan = allPlans.find(p => p.id === sheetRef || p.code === sheetRef)
    if (plan) {
      setSelectedPlan(plan)
    }
  }, [folders])

  const sheetToplan = (sheet: Sheet): Plan => ({
    id: sheet.id,
    code: sheet.number,
    title: sheet.title,
    thumbnail: sheet.imagePath
  })

  const filteredFolders = folders.map(folder => ({
    ...folder,
    sheets: folder.sheets.filter(sheet =>
      sheet.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sheet.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    folder.sheets.length > 0
  )

  const isLoading = !projectId

  return (
    <View className="flex-1 bg-background">
      {/* Search and Toggle Header */}
      <View className="px-4 py-3 gap-4">
        <View className="flex-row items-center gap-2">
          <View className="flex-1 relative">
            <View className="absolute left-3 top-2.5 z-10">
              <Icon as={Search} className="size-4 text-muted-foreground" />
            </View>
            <Input
              placeholder="Search plans"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="pl-10 h-10 bg-muted/40 border-transparent rounded-xl"
            />
            {/* Magnifying glass/QR scanner placeholder */}
            <Pressable 
              className="absolute right-3 top-2.5 z-10 p-0.5 active:bg-muted/20 rounded"
              onPress={() => setIsSelectorVisible(true)}
            >
              <Icon as={Maximize2} className="size-4 text-muted-foreground" />
            </Pressable>
          </View>
          
          <View className="flex-row bg-muted/20 rounded-xl p-1">
            <Pressable 
              onPress={() => setViewMode('grid')}
              className={cn(
                "p-1.5 rounded-lg",
                viewMode === 'grid' ? "bg-background shadow-sm" : "bg-transparent"
              )}
            >
              <Icon as={LayoutGrid} className={cn("size-4", viewMode === 'grid' ? "text-foreground" : "text-muted-foreground")} />
            </Pressable>
            <Pressable 
              onPress={() => setViewMode('list')}
              className={cn(
                "p-1.5 rounded-lg",
                viewMode === 'list' ? "bg-background shadow-sm" : "bg-transparent"
              )}
            >
              <Icon as={List} className={cn("size-4", viewMode === 'list' ? "text-foreground" : "text-muted-foreground")} />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        {isLoading && (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" />
          </View>
        )}

        {!isLoading && folders.length === 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <Icon as={FileText} className="size-16 text-muted-foreground mb-4" />
            <Text className="text-lg font-semibold text-foreground mb-2">No Plans Yet</Text>
            <Text className="text-sm text-muted-foreground text-center px-8">
              Plans and sheets will appear here once they're uploaded to this project
            </Text>
          </View>
        )}

        {!isLoading && filteredFolders.map((folder) => (
          <Collapsible
            key={folder.id}
            open={expandedFolders.includes(folder.id)}
            onOpenChange={() => toggleFolder(folder.id)}
            className="mb-4"
          >
            <CollapsibleTrigger asChild>
              <Pressable className="flex-row items-center justify-between py-3 px-4 bg-muted/10 rounded-xl">
                <View className="flex-row items-center gap-3 flex-1">
                  <Icon as={Folder} className="size-5 text-muted-foreground" />
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                      {folder.name}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {folder.sheets.length} plans
                    </Text>
                  </View>
                </View>
                <Icon 
                  as={expandedFolders.includes(folder.id) ? ChevronDown : ChevronRight} 
                  className="size-5 text-muted-foreground" 
                />
              </Pressable>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <View className="pt-2">
                {viewMode === 'grid' ? (
                  <View className="flex-row flex-wrap gap-3">
                    {folder.sheets.map(sheet => {
                      const plan = sheetToplan(sheet)
                      return (
                        <Pressable
                          key={sheet.id}
                          className="w-[48%] mb-4 active:opacity-80"
                          onPress={() => handleOpenPlan(plan)}
                        >
                          <View className="aspect-[3/2] bg-muted/20 rounded-xl overflow-hidden border border-border/50">
                            <Image
                              source={{ uri: sheet.imagePath }}
                              className="w-full h-full"
                              resizeMode="cover"
                            />
                          </View>
                          <View className="mt-2 items-center">
                            <Text className="text-sm font-bold text-foreground text-center" numberOfLines={1}>
                              {sheet.number}
                            </Text>
                            <Text className="text-[10px] text-muted-foreground text-center" numberOfLines={1}>
                              {sheet.title}
                            </Text>
                          </View>
                        </Pressable>
                      )
                    })}
                  </View>
                ) : (
                  <View className="gap-1">
                    {folder.sheets.map((sheet) => {
                      const plan = sheetToplan(sheet)
                      return (
                        <Pressable
                          key={sheet.id}
                          className="flex-row items-center gap-4 py-3 px-2 active:bg-muted/10 rounded-lg"
                          onPress={() => handleOpenPlan(plan)}
                        >
                          <View className="size-10 bg-muted/20 rounded-lg items-center justify-center">
                            <Icon as={FileText} className="size-5 text-muted-foreground" />
                          </View>
                          <View className="flex-1">
                            <Text className="text-base font-bold text-foreground">
                              {sheet.number}
                            </Text>
                            <Text className="text-sm text-muted-foreground">
                              {sheet.title}
                            </Text>
                          </View>
                        </Pressable>
                      )
                    })}
                  </View>
                )}
                {folder.sheets.length === 0 && (
                  <View className="py-8 items-center justify-center">
                    <Text className="text-sm text-muted-foreground italic">No plans in this folder</Text>
                  </View>
                )}
              </View>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </ScrollView>

      {/* Plan Selector Modal */}
      <Modal
        visible={isSelectorVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsSelectorVisible(false)}
      >
        <PlanSelector
          projectId={projectId!}
          onSelect={handleSelectPlan}
          onClose={() => setIsSelectorVisible(false)}
          showCloseButton
        />
      </Modal>

      {/* Full-screen Plan Viewer */}
      <Modal
        visible={isViewerVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseViewer}
        statusBarTranslucent
      >
        {selectedPlan && (
          <PlanViewer
            planId={selectedPlan.id}
            planCode={selectedPlan.code}
            planTitle={selectedPlan.title}
            imageUrl="https://picsum.photos/2000/1500"
            onClose={handleCloseViewer}
            onSheetChange={handleSheetChange}
          />
        )}
      </Modal>
    </View>
  )
}
