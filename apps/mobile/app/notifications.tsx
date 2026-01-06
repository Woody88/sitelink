import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Info, AlertTriangle, CheckCircle } from 'lucide-react-native';
import * as React from 'react';
import { SectionList, View, Pressable } from 'react-native';
import { Stack } from 'expo-router';

const NOTIFICATIONS_DATA = [
  {
    title: 'This Week',
    data: [
        { 
            id: '1', 
            title: 'Plan Processing Complete', 
            body: 'Riverside Apartments plans are ready to view.', 
            time: '2h ago',
            type: 'success'
        },
        { 
            id: '2', 
            title: 'New Issue Flagged', 
            body: 'Mike flagged an issue at 5/A7.', 
            time: '5h ago',
            type: 'alert'
        },
        { 
            id: '3', 
            title: 'Trial Ending Soon', 
            body: 'Your Pro trial ends in 3 days.', 
            time: '2 days ago',
            type: 'info'
        },
        { 
            id: '4', 
            title: 'Sheet Updated', 
            body: 'Floor 2 Electrical has been updated.', 
            time: '3 days ago',
            type: 'info'
        },
    ]
  }
];

export default function NotificationsScreen() {
  const getIcon = (type: string) => {
    switch (type) {
        case 'success': return CheckCircle;
        case 'alert': return AlertTriangle;
        default: return Info;
    }
  };

  const getColor = (type: string) => {
      switch (type) {
          case 'success': return 'text-green-500';
          case 'alert': return 'text-amber-500';
          default: return 'text-blue-500';
      }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen 
        options={{ 
          headerTitle: () => <Text className="text-foreground text-lg font-bold">Notifications</Text>,
          headerShown: true,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: '#121212',
          },
          headerTitleAlign: 'center',
        }} 
      />
      
      <SectionList
        sections={NOTIFICATIONS_DATA}
        contentContainerClassName="pb-12"
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
            <View className="px-4 py-4">
                <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</Text>
            </View>
        )}
        renderItem={({ item }) => (
          <Pressable className="flex-row gap-4 px-4 py-4 active:bg-muted/30">
              <View className="size-8 rounded-full bg-muted/20 items-center justify-center">
                  <Icon 
                      as={getIcon(item.type)} 
                      className={`size-4 ${getColor(item.type)}`} 
                  />
              </View>
              <View className="flex-1 gap-0.5">
                  <View className="flex-row justify-between items-start">
                      <Text className="font-semibold text-base flex-1 pr-2 leading-tight">{item.title}</Text>
                      <Text className="text-xs text-muted-foreground mt-0.5">{item.time}</Text>
                  </View>
                  <Text className="text-sm text-muted-foreground leading-snug">{item.body}</Text>
              </View>
          </Pressable>
        )}
      />
    </View>
  );
}
