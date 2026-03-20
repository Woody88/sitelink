import { Stack } from "expo-router"
import { Search, UserPlus } from "lucide-react-native"
import * as React from "react"
import { Platform, Pressable, ScrollView, View } from "react-native"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { FormField } from "@/components/ui/form-field"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { MOCK_TEAM_MEMBERS } from "@/lib/mock-data"
import { isPrototypeMode } from "@/lib/prototype-mode"
import { cn } from "@/lib/utils"

export default function MembersScreen() {
  if (isPrototypeMode()) return <PrototypeMembersScreen />
  return <PrototypeMembersScreen />
}

function PrototypeMembersScreen() {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [showAddSheet, setShowAddSheet] = React.useState(false)
  const [newEmail, setNewEmail] = React.useState("")
  const [newRole, setNewRole] = React.useState<"Admin" | "Member" | "Viewer">("Member")

  const filteredMembers = React.useMemo(() => {
    if (!searchQuery) return MOCK_TEAM_MEMBERS
    return MOCK_TEAM_MEMBERS.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
  }, [searchQuery])

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Owner":
        return "default" as const
      case "Admin":
        return "info" as const
      default:
        return "secondary" as const
    }
  }

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <View className="bg-background flex-1" style={webMinHeight}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <Text className="text-foreground text-lg font-bold">Team Members</Text>
          ),
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: "center",
          headerRight: () => (
            <IconButton icon={UserPlus} label="Add Member" onPress={() => setShowAddSheet(true)} />
          ),
        }}
      />

      <View className="px-4 py-2">
        <Input
          leftIcon={Search}
          placeholder="Search members..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          size="lg"
          className="bg-muted/40 border-transparent"
        />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-2 pb-8">
        {filteredMembers.map((member, index) => (
          <React.Fragment key={member.id}>
            {index > 0 && <Divider inset={52} />}
            <View className="flex-row items-center gap-3 py-3.5">
              <Avatar name={member.name} />
              <View className="flex-1">
                <Text className="text-foreground font-medium">{member.name}</Text>
                <Text className="text-muted-foreground text-sm">{member.email}</Text>
              </View>
              <Badge variant={getRoleBadgeVariant(member.role)} size="sm">
                <Text>{member.role}</Text>
              </Badge>
            </View>
          </React.Fragment>
        ))}
      </ScrollView>

      <BottomSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
        title="Add Team Member"
      >
        <View className="gap-6 px-6 pb-8">
          <FormField label="Email Address" nativeID="addMemberEmail">
            <Input
              nativeID="addMemberEmail"
              placeholder="member@example.com"
              value={newEmail}
              onChangeText={setNewEmail}
              size="lg"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </FormField>
          <View className="gap-2">
            <Text className="text-foreground text-sm font-medium">Role</Text>
            <View className="flex-row gap-2">
              {(["Admin", "Member", "Viewer"] as const).map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setNewRole(role)}
                  className={cn(
                    "flex-1 rounded-xl border-2 px-4 py-3",
                    newRole === role ? "bg-primary border-primary" : "bg-muted/10 border-border",
                  )}
                >
                  <Text
                    className={cn(
                      "text-center font-medium",
                      newRole === role ? "text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Button
            onPress={() => {
              setNewEmail("")
              setNewRole("Member")
              setShowAddSheet(false)
            }}
            disabled={!newEmail.trim()}
            className="h-12 rounded-xl"
          >
            <Icon as={UserPlus} className="text-primary-foreground mr-2 size-5" />
            <Text className="text-primary-foreground font-semibold">Add Member</Text>
          </Button>
        </View>
      </BottomSheet>
    </View>
  )
}
