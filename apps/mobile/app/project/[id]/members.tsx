import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Plus, MoreHorizontal, Search, X, UserPlus } from 'lucide-react-native';
import * as React from 'react';
import { FlatList, View, TextInput, Alert, Modal, Pressable } from 'react-native';
import { Stack } from 'expo-router';

const MOCK_MEMBERS = [
  { id: '1', name: 'John Smith', email: 'john@sitelink.com', role: 'Owner' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@design.com', role: 'Admin' },
  { id: '3', name: 'Mike Chen', email: 'mike@electric.com', role: 'Member' },
  { id: '4', name: 'Client View', email: 'view@client.com', role: 'Viewer' },
];

export default function MembersScreen() {
  const [search, setSearch] = React.useState('');
  const [members, setMembers] = React.useState(MOCK_MEMBERS);
  const [isAddModalVisible, setIsAddModalVisible] = React.useState(false);
  const [newMemberEmail, setNewMemberEmail] = React.useState('');
  const [newMemberRole, setNewMemberRole] = React.useState<'Admin' | 'Member' | 'Viewer'>('Member');

  const filteredMembers = React.useMemo(() => {
    if (!search) return members;
    return members.filter(m => 
        m.name.toLowerCase().includes(search.toLowerCase()) || 
        m.email.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, members]);

  const handleAddMember = () => {
    if (!newMemberEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    // Validate email format (basic)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMemberEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Check if member already exists
    if (members.some(m => m.email.toLowerCase() === newMemberEmail.toLowerCase())) {
      Alert.alert('Error', 'This member is already in the project');
      return;
    }

    // TODO: Add member via API/LiveStore
    const newMember = {
      id: `member-${Date.now()}`,
      name: newMemberEmail.split('@')[0], // Use email prefix as name for now
      email: newMemberEmail,
      role: newMemberRole,
    };

    setMembers([...members, newMember]);
    setNewMemberEmail('');
    setNewMemberRole('Member');
    setIsAddModalVisible(false);
    Alert.alert('Success', 'Member added successfully');
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName} from this project?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // TODO: Remove member via API/LiveStore
            setMembers(members.filter(m => m.id !== memberId));
            Alert.alert('Success', 'Member removed successfully');
          },
        },
      ]
    );
  };

  const handleManageMember = (memberId: string) => {
    Alert.alert(
      'Manage Member',
      'Change role or remove member',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const member = members.find(m => m.id === memberId);
            if (member) {
              handleRemoveMember(memberId, member.name);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Project Members',
          headerShown: true,
          headerTitleAlign: 'center',
          headerRight: () => (
            <Button 
              size="icon" 
              variant="ghost"
              onPress={() => setIsAddModalVisible(true)}
            >
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onPress={() => handleManageMember(item.id)}
                    >
                        <Icon as={MoreHorizontal} className="size-4 text-muted-foreground" />
                    </Button>
                </View>
            </CardContent>
          </Card>
        )}
      />

      {/* Add Member Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View className="flex-1 bg-background">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-border/10">
            <Text className="text-lg font-bold">Add Team Member</Text>
            <Pressable 
              onPress={() => setIsAddModalVisible(false)}
              className="size-8 items-center justify-center rounded-full bg-muted/20 active:bg-muted/40"
            >
              <Icon as={X} className="size-5 text-foreground" />
            </Pressable>
          </View>

          {/* Content */}
          <View className="flex-1 p-6 gap-6">
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Email Address</Text>
              <Input
                placeholder="member@example.com"
                value={newMemberEmail}
                onChangeText={setNewMemberEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Role</Text>
              <View className="flex-row gap-2">
                {(['Admin', 'Member', 'Viewer'] as const).map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setNewMemberRole(role)}
                    className={`
                      flex-1 py-3 px-4 rounded-xl border-2
                      ${newMemberRole === role 
                        ? 'bg-primary border-primary' 
                        : 'bg-muted/10 border-border'
                      }
                    `}
                  >
                    <Text className={`
                      text-center font-medium
                      ${newMemberRole === role 
                        ? 'text-primary-foreground' 
                        : 'text-foreground'
                      }
                    `}>
                      {role}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mt-auto gap-3">
              <Button onPress={handleAddMember} className="h-12">
                <Icon as={UserPlus} className="size-5 text-primary-foreground mr-2" />
                <Text className="text-base font-semibold text-primary-foreground">
                  Add Member
                </Text>
              </Button>
              <Button 
                variant="outline" 
                onPress={() => setIsAddModalVisible(false)}
                className="h-12"
              >
                <Text className="text-base font-semibold">Cancel</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
