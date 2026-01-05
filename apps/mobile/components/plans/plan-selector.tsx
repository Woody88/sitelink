import * as React from 'react'
import { View, ScrollView, Pressable, Image } from 'react-native'
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
  Maximize2,
  X
} from 'lucide-react-native'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { MOCK_FOLDERS } from '@/constants/mock-data'

export interface Plan {
  id: string
  code: string
  title: string
  thumbnail: string
}

interface PlanSelectorProps {
  onSelect: (plan: Plan) => void
  onClose?: () => void
  showCloseButton?: boolean
}

export function PlanSelector({ onSelect, onClose, showCloseButton = false }: PlanSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('list')
  const [expandedFolders, setExpandedFolders] = React.useState<string[]>(['f1'])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => 
      prev.includes(folderId) 
        ? prev.filter(id => id !== folderId) 
        : [...prev, folderId]
    )
  }

  const filteredFolders = MOCK_FOLDERS.map(folder => ({
    ...folder,
    plans: folder.plans.filter(plan => 
      plan.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(folder => 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    folder.plans.length > 0
  )

  return (
    <View className="flex-1 bg-background">
      {/* Header with Search and Close */}
      <View className="px-4 py-3 gap-4 border-b border-border/10">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xl font-bold text-foreground">Select Plan</Text>
          {showCloseButton && onClose && (
            <Pressable onPress={onClose} className="p-2 rounded-full active:bg-muted/20">
              <Icon as={X} className="size-6 text-foreground" />
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center gap-2">
          <View className="flex-1 relative">
            <View className="absolute left-3 top-2.5 z-10">
              <Icon as={Search} className="size-4 text-muted-foreground" />
            </View>
            <Input
              placeholder="Search plans"
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="pl-10 h-10 bg-muted/20 border-transparent rounded-xl"
            />
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

      <ScrollView className="flex-1" contentContainerClassName="px-4 py-4 pb-8">
        {filteredFolders.map((folder) => (
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
                      {folder.plans.length} plans
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
                    {folder.plans.map(plan => (
                      <Pressable 
                        key={plan.id} 
                        className="w-[48%] mb-4 active:opacity-70"
                        onPress={() => onSelect(plan)}
                      >
                        <View className="aspect-[3/2] bg-muted/20 rounded-xl overflow-hidden border border-border/50">
                          <Image 
                            source={{ uri: plan.thumbnail }} 
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        </View>
                        <View className="mt-2 items-center">
                          <Text className="text-sm font-bold text-foreground text-center" numberOfLines={1}>
                            {plan.code}
                          </Text>
                          <Text className="text-[10px] text-muted-foreground text-center" numberOfLines={1}>
                            {plan.title}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View className="gap-1">
                    {folder.plans.map((plan) => (
                      <Pressable 
                        key={plan.id} 
                        className="flex-row items-center gap-4 py-3 px-2 active:bg-muted/10 rounded-lg"
                        onPress={() => onSelect(plan)}
                      >
                        <View className="size-10 bg-muted/20 rounded-lg items-center justify-center">
                          <Icon as={FileText} className="size-5 text-muted-foreground" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-bold text-foreground">
                            {plan.code}
                          </Text>
                          <Text className="text-sm text-muted-foreground">
                            {plan.title}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
                {folder.plans.length === 0 && (
                  <View className="py-8 items-center justify-center">
                    <Text className="text-sm text-muted-foreground italic">No plans in this folder</Text>
                  </View>
                )}
              </View>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </ScrollView>
    </View>
  )
}

