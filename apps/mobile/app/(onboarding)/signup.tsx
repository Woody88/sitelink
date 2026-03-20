import { useRouter } from "expo-router"
import { Eye, EyeOff } from "lucide-react-native"
import * as React from "react"
import { Platform, Pressable, ScrollView, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { FormField } from "@/components/ui/form-field"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"

export default function SignupScreen() {
  const router = useRouter()
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [company, setCompany] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)

  const isFormValid = name.trim() && email.trim() && password.trim()

  const handleCreateAccount = () => {
    router.replace("/projects" as any)
  }

  const webMinHeight = Platform.select({
    web: { minHeight: "100vh" as any },
    default: undefined,
  })

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="px-6 pb-10 pt-12"
      style={webMinHeight}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-8">
        <Text className="text-foreground text-2xl font-bold">Create Account</Text>
        <Text className="text-muted-foreground mt-1 text-base">Join SiteLink to get started</Text>
      </View>

      <View className="gap-3">
        <Button
          variant="outline"
          className="h-12 w-full flex-row items-center gap-3 rounded-xl"
          onPress={() => router.replace("/projects" as any)}
        >
          <Text className="text-foreground text-base font-medium">Continue with Google</Text>
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full flex-row items-center gap-3 rounded-xl"
          onPress={() => router.replace("/projects" as any)}
        >
          <Text className="text-foreground text-base font-medium">Continue with Apple</Text>
        </Button>
      </View>

      <View className="my-6 flex-row items-center gap-4">
        <Divider className="flex-1" />
        <Text className="text-muted-foreground text-sm">Or</Text>
        <Divider className="flex-1" />
      </View>

      <View className="gap-5">
        <FormField label="Full Name" nativeID="signupName">
          <Input
            nativeID="signupName"
            size="lg"
            placeholder="John Smith"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </FormField>

        <FormField label="Email" nativeID="signupEmail">
          <Input
            nativeID="signupEmail"
            size="lg"
            placeholder="john@company.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </FormField>

        <FormField label="Password" nativeID="signupPassword">
          <Input
            nativeID="signupPassword"
            size="lg"
            placeholder="Create a password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            rightElement={
              <Pressable onPress={() => setShowPassword((v) => !v)}>
                <Icon as={showPassword ? EyeOff : Eye} className="text-muted-foreground size-5" />
              </Pressable>
            }
          />
        </FormField>

        <FormField label="Company Name" nativeID="signupCompany">
          <Input
            nativeID="signupCompany"
            size="lg"
            placeholder="Smith Electrical LLC"
            value={company}
            onChangeText={setCompany}
          />
        </FormField>
      </View>

      <View className="mt-8">
        <Button
          className="h-14 w-full rounded-xl"
          onPress={handleCreateAccount}
          disabled={!isFormValid}
        >
          <Text className="text-primary-foreground text-base font-semibold">Create Account</Text>
        </Button>
      </View>
    </ScrollView>
  )
}
