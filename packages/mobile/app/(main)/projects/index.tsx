import { View, ScrollView, Pressable } from 'react-native';
import { Link, router } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

// Placeholder data - will be replaced with API calls later
const mockProjects = [
  { id: '1', name: 'Downtown Office Complex', status: 'Active' },
  { id: '2', name: 'Residential Tower A', status: 'Planning' },
  { id: '3', name: 'Shopping Mall Renovation', status: 'Active' },
];

export default function ProjectsScreen() {
  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 px-6 py-6 gap-4">
        <View className="gap-2 mb-4">
          <Text className="text-3xl font-bold text-foreground">Projects</Text>
          <Text className="text-base text-muted-foreground">
            Manage your construction projects and plans
          </Text>
        </View>

        <View className="gap-3">
          {mockProjects.map((project) => (
            <Link
              key={project.id}
              href={`/(main)/projects/${project.id}/plans`}
              asChild
            >
              <Pressable className="border border-input rounded-lg p-4 bg-card active:bg-accent">
                <View className="gap-2">
                  <Text className="text-lg font-semibold text-foreground">
                    {project.name}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <View className="px-2 py-1 bg-secondary rounded">
                      <Text className="text-xs font-medium text-secondary-foreground">
                        {project.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>

        <Button 
          className="mt-4"
          onPress={() => console.log('Add new project')}
        >
          <Text>Add New Project</Text>
        </Button>
      </View>
    </ScrollView>
  );
}
