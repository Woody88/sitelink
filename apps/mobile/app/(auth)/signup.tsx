// apps/mobile/app/(auth)/signup.tsx
import { useState } from "react"
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native"
import { useRouter } from "expo-router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { SyncStatus } from "@/components/SyncStatus"

export default function SignUpScreen() {
  const router = useRouter()
  const { signUp } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignUp() {
    if (!name || !email || !password) {
      setError("Please fill in all fields")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    setError(null)
    setLoading(true)

    const result = await signUp(email, password, name)

    if (result.success) {
      if (result.isNewUser) {
        router.replace("/(auth)/biometric-setup" as any)
      } else {
        router.replace("/(tabs)/plan" as any)
      }
    } else {
      setError(result.error || "Sign up failed")
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView
        contentContainerClassName="flex-1 justify-center p-6 gap-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-2">
          <SyncStatus size="sm" showText={true} />
        </View>

        <View className="gap-2">
          <Text variant="h1" className="text-center">
            Create Account
          </Text>
          <Text variant="muted" className="text-center">
            Sign up to get started with SiteLink
          </Text>
        </View>

        <View className="gap-4">
          <View className="gap-2">
            <Label nativeID="name-label">
              <Text>Name</Text>
            </Label>
            <Input
              testID="name-input"
              nativeID="name-input"
              placeholder="Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              editable={!loading}
            />
          </View>

          <View className="gap-2">
            <Label nativeID="email-label">
              <Text>Email</Text>
            </Label>
            <Input
              testID="email-input"
              nativeID="email-input"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
          </View>

          <View className="gap-2">
            <Label nativeID="password-label">
              <Text>Password</Text>
            </Label>
            <Input
              testID="password-input"
              nativeID="password-input"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!loading}
            />
          </View>

          {error && (
            <Text className="text-destructive text-sm">{error}</Text>
          )}

          <Button
            testID="signup-button"
            onPress={handleSignUp}
            disabled={loading}
            className="mt-2"
          >
            <Text>Sign Up</Text>
          </Button>
        </View>

        <View className="flex-row justify-center gap-2">
          <Text variant="muted">Already have an account?</Text>
          <Button
            variant="link"
            testID="login-link"
            onPress={() => router.push("/(auth)/login" as any)}
            disabled={loading}
          >
            <Text variant="link">Sign In</Text>
          </Button>
        </View>

        <View className="gap-3 mt-4">
          <Button
            variant="outline"
            testID="oauth-google-button"
            disabled
            className="opacity-50"
          >
            <Text>Continue with Google</Text>
            <Text variant="muted" className="text-xs ml-2">
              (Coming Soon)
            </Text>
          </Button>

          <Button
            variant="outline"
            testID="oauth-microsoft-button"
            disabled
            className="opacity-50"
          >
            <Text>Continue with Microsoft</Text>
            <Text variant="muted" className="text-xs ml-2">
              (Coming Soon)
            </Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

