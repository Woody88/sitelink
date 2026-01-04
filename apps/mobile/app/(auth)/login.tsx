// apps/mobile/app/(auth)/login.tsx
import { useState } from 'react'
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { SyncStatus } from '@/components/SyncStatus'

export default function LoginScreen() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignIn() {
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    setError(null)
    setLoading(true)

    const result = await signIn(email, password)

    if (result.success) {
      // Don't redirect immediately - let _layout.tsx handle biometric check first
      // The routing logic in _layout.tsx will redirect after biometric check completes
    } else {
      setError(result.error || 'Sign in failed')
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1">
      <ScrollView
        contentContainerClassName="flex-1 justify-center p-6 gap-6"
        keyboardShouldPersistTaps="handled">
        <View className="mb-2 items-center">
          <SyncStatus size="sm" showText={true} />
        </View>

        <View className="gap-2">
          <Text variant="h1" className="text-center">
            Sign In
          </Text>
          <Text variant="muted" className="text-center">
            Enter your email and password to continue
          </Text>
        </View>

        <View className="gap-4">
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
              autoComplete="password"
              editable={!loading}
            />
          </View>

          {error && <Text className="text-destructive text-sm">{error}</Text>}

          <Button testID="signin-button" onPress={handleSignIn} disabled={loading} className="mt-2">
            <Text>Sign In</Text>
          </Button>
        </View>

        <View className="flex-row justify-center gap-2">
          <Text variant="muted">Don't have an account?</Text>
          <Button
            variant="link"
            testID="signup-link"
            onPress={() => router.push('/(auth)/signup' as any)}
            disabled={loading}>
            <Text variant="link">Sign Up</Text>
          </Button>
        </View>

        <View className="mt-4 gap-3">
          <Button variant="outline" testID="oauth-google-button" disabled className="opacity-50">
            <Text>Continue with Google</Text>
            <Text variant="muted" className="ml-2 text-xs">
              (Coming Soon)
            </Text>
          </Button>

          <Button variant="outline" testID="oauth-microsoft-button" disabled className="opacity-50">
            <Text>Continue with Microsoft</Text>
            <Text variant="muted" className="ml-2 text-xs">
              (Coming Soon)
            </Text>
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
