import { memo } from 'react'
import { View } from 'react-native'
import { MapPin } from 'lucide-react-native'
import { Icon } from '@/components/ui/icon'
import { Text } from '@/components/ui/text'

export interface ProjectContextProps {
  projectName: string
  address?: string
}

export const ProjectContext = memo(function ProjectContext({
  projectName,
  address,
}: ProjectContextProps) {
  return (
    <View className="px-4 py-3 bg-muted/10">
      <Text className="text-foreground text-base font-semibold" numberOfLines={1}>
        {projectName}
      </Text>
      {address && (
        <View className="flex-row items-center mt-1">
          <Icon as={MapPin} className="size-3.5 text-muted-foreground mr-1" />
          <Text className="text-muted-foreground text-sm" numberOfLines={1}>
            {address}
          </Text>
        </View>
      )}
    </View>
  )
})
