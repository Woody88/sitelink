import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/ui/icon';

interface SettingsItemProps {
  icon?: any;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  className?: string;
  destructive?: boolean;
}

export function SettingsItem({
  icon,
  label,
  value,
  onPress,
  rightElement,
  className,
  destructive,
}: SettingsItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-between py-4 active:opacity-70',
        className
      )}
    >
      <View className="flex-row items-center gap-3">
        {icon && (
          <View className="size-8 items-center justify-center rounded-full bg-muted">
            <Icon as={icon} className={cn("size-4 text-foreground", destructive && "text-destructive")} />
          </View>
        )}
        <Text className={cn("text-base font-medium", destructive && "text-destructive")}>
          {label}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        {value && <Text className="text-muted-foreground">{value}</Text>}
        {rightElement}
        {!rightElement && onPress && (
          <Icon as={ChevronRight} className="size-5 text-muted-foreground" />
        )}
      </View>
    </Pressable>
  );
}
