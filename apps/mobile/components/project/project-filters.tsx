import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react-native';
import * as React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FilterOption {
  label: string;
  value: string;
}

interface ProjectFiltersProps {
  isVisible: boolean;
  onClose: () => void;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const STATUS_FILTERS: FilterOption[] = [
  { label: 'All Projects', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Archived', value: 'archived' },
];

export function ProjectFilters({ isVisible, onClose, activeFilter, onFilterChange }: ProjectFiltersProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="flex-1" onPress={onClose} />
        <View 
            className="bg-background rounded-t-[20px] border-t border-border"
            style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="flex-row items-center justify-between p-6 border-b border-border">
            <Text variant="h3">Filter Projects</Text>
            <Pressable onPress={onClose} className="p-2 -mr-2">
              <X size={24} className="text-foreground" />
            </Pressable>
          </View>
          
          <View className="p-6 gap-4">
            <Text className="text-muted-foreground font-medium mb-2">Status</Text>
            <View className="flex-row flex-wrap gap-3">
              {STATUS_FILTERS.map((filter) => (
                <Pressable
                  key={filter.value}
                  onPress={() => {
                    onFilterChange(filter.value);
                    onClose();
                  }}
                >
                  <Badge 
                    variant={activeFilter === filter.value ? 'default' : 'outline'}
                    className={cn(
                        "px-4 py-2",
                        activeFilter !== filter.value && "bg-transparent border-input"
                    )}
                  >
                    <Text className={cn(
                        "text-sm font-medium",
                        activeFilter === filter.value ? "text-primary-foreground" : "text-foreground"
                    )}>
                        {filter.label}
                    </Text>
                  </Badge>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
