import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Plus, MoreHorizontal, Search } from 'lucide-react-native';
import * as React from 'react';
import { FlatList, View, TextInput } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_MEMBERS = [
  { id: '1', name: 'John Smith', email: 'john@sitelink.com', role: 'Owner' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@design.com', role: 'Admin' },
  { id: '3', name: 'Mike Chen', email: 'mike@electric.com', role: 'Member' },
  { id: '4', name: 'Client View', email: 'view@client.com', role: 'Viewer' },
];

export default function MembersScreen() {
  const [search, setSearch] = React.useState('');

  const filteredMembers = React.useMemo(() => {
    if (!search) return MOCK_MEMBERS;
    return MOCK_MEMBERS.filter(m => 
        m.name.toLowerCase().includes(search.toLowerCase()) || 
        m.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: 'Project Members',
          headerShown: true,
          headerRight: () => (
            <Button size="icon" variant="ghost">
                <Icon as={Plus} className="size-6 text-primary" />
            </Button>
          ),
        }}
      />
      
      <View className="px-4 py-2 bg-background border-b border-border">
        <View className="flex-row items-center bg-muted rounded-xl px-3 h-10">
            <Icon as={Search} className="size-4 text-muted-foreground mr-2" />
            <TextInput 
                className="flex-1 text-foreground h-full"
                placeholder="Search members..."
                placeholderTextColor="hsl(var(--muted-foreground))"
                value={search}
                onChangeText={setSearch}
            />
        </View>
      </View>

      <FlatList
        data={filteredMembers}
        contentContainerClassName="p-4 gap-4"
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card>
            <CardContent className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center gap-3">
                    <View className="size-10 rounded-full bg-secondary items-center justify-center">
                        <Text className="font-semibold text-secondary-foreground">
                            {item.name.charAt(0)}
                        </Text>
                    </View>
                    <View>
                        <Text className="font-medium">{item.name}</Text>
                        <Text className="text-sm text-muted-foreground">{item.email}</Text>
                    </View>
                </View>
                <View className="flex-row items-center gap-2">
                    <Badge variant={item.role === 'Owner' ? 'default' : 'outline'}>
                        <Text className={item.role === 'Owner' ? 'text-primary-foreground' : 'text-foreground'}>
                            {item.role}
                        </Text>
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
                    </Button>
                </View>
            </CardContent>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
