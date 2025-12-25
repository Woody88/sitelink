import { View, ScrollView, Pressable } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

// Placeholder data - will be replaced with API calls later
const mockPlans = [
  { id: '1', name: 'Floor Plan - Level 1', type: 'Architectural', date: '2024-01-15' },
  { id: '2', name: 'Electrical Layout', type: 'Electrical', date: '2024-01-20' },
  { id: '3', name: 'Plumbing Diagram', type: 'Plumbing', date: '2024-01-25' },
];

export default function PlansScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-6 gap-4">
        <View className="gap-2 mb-4">
          <Text className="text-3xl font-bold text-foreground">Plans</Text>
          <Text className="text-base text-muted-foreground">
            Project ID: {projectId}
          </Text>
        </View>

        <View className="gap-3">
          {mockPlans.map((plan) => (
            <Link
              key={plan.id}
              href={`/(main)/projects/${projectId}/plans/${plan.id}`}
              asChild
            >
              <Pressable className="border border-input rounded-lg p-4 bg-card active:bg-accent">
                <View className="gap-2">
                  <Text className="text-lg font-semibold text-foreground">
                    {plan.name}
                  </Text>
                  <View className="flex-row items-center gap-3">
                    <View className="px-2 py-1 bg-muted rounded">
                      <Text className="text-xs font-medium text-muted-foreground">
                        {plan.type}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {plan.date}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>

        <Button 
          className="mt-4"
          onPress={() => console.log('Add new plan')}
        >
          <Text>Add New Plan</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
