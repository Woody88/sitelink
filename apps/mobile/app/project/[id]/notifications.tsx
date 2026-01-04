import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Info, AlertTriangle, CheckCircle } from 'lucide-react-native';
import * as React from 'react';
import { SectionList, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const NOTIFICATIONS_DATA = [
  {
    title: 'Today',
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
    ]
  },
  {
    title: 'This Week',
    data: [
        { 
            id: '3', 
            title: 'Trial Ending Soon', 
            body: 'Your Pro trial ends in 3 days.', 
            time: '1d ago',
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
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: 'Notifications', headerShown: true }} />
      
      <SectionList
        sections={NOTIFICATIONS_DATA}
        contentContainerClassName="p-4 gap-4"
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
            <Text className="text-sm font-semibold text-muted-foreground mt-2 mb-2">{title}</Text>
        )}
        renderItem={({ item }) => (
          <Card className="mb-3">
            <CardContent className="flex-row gap-4 p-4">
                <View className="mt-1">
                    <Icon 
                        as={getIcon(item.type)} 
                        className={`size-5 ${getColor(item.type)}`} 
                    />
                </View>
                <View className="flex-1 gap-1">
                    <View className="flex-row justify-between">
                        <Text className="font-semibold">{item.title}</Text>
                        <Text className="text-xs text-muted-foreground">{item.time}</Text>
                    </View>
                    <Text className="text-muted-foreground">{item.body}</Text>
                </View>
            </CardContent>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
