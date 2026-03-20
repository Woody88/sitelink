import { Stack, useRouter } from "expo-router"
import { Camera, CheckCircle, Copy, MapPin, Mic, Send, Share2, Sparkles } from "lucide-react-native"
import * as React from "react"
import { View } from "react-native"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Icon } from "@/components/ui/icon"
import { ScreenLayout } from "@/components/ui/screen-layout"
import { StatusScreen } from "@/components/ui/status-screen"
import { Text } from "@/components/ui/text"
import { Toast } from "@/components/ui/toast"
import { MOCK_RFI_CONTENT } from "@/lib/mock-data"

type FlowState = "context" | "generating" | "draft" | "sent"

function SkeletonBar({ widthPercent }: { widthPercent: number }) {
  return (
    <View style={{ width: `${widthPercent}%` as any, opacity: 0.5 }}>
      <View className="bg-muted/20 h-4 w-full rounded-lg" />
    </View>
  )
}

function GeneratingState() {
  return (
    <View className="flex-1 items-center justify-center px-6 pt-20">
      <View
        className="mb-6 items-center justify-center rounded-2xl"
        style={{
          width: 64,
          height: 64,
          backgroundColor: "rgba(168,85,247,0.1)",
        }}
      >
        <Icon as={Sparkles} className="size-8 text-purple-500" />
      </View>
      <Text className="text-foreground mb-2 text-lg font-bold">Generating RFI...</Text>
      <Text className="text-muted-foreground mb-8 text-center text-sm">
        AI is drafting a formal Request for Information...
      </Text>
      <View className="w-full gap-4">
        <SkeletonBar widthPercent={100} />
        <SkeletonBar widthPercent={90} />
        <SkeletonBar widthPercent={75} />
      </View>
    </View>
  )
}

export default function RFIScreen() {
  const router = useRouter()
  const [state, setState] = React.useState<FlowState>("context")
  const [toastMessage, setToastMessage] = React.useState("")
  const [toastVisible, setToastVisible] = React.useState(false)

  const handleGenerate = React.useCallback(() => {
    setState("generating")
    setTimeout(() => setState("draft"), 2000)
  }, [])

  const handleSend = React.useCallback(() => {
    setState("sent")
  }, [])

  const handleCopy = React.useCallback(() => {
    setToastMessage("RFI copied to clipboard")
    setToastVisible(true)
  }, [])

  const handleShareDraft = React.useCallback(() => {
    setToastMessage("Share sheet opened")
    setToastVisible(true)
  }, [])

  const handleDismissToast = React.useCallback(() => {
    setToastVisible(false)
  }, [])

  const handleBackToProject = React.useCallback(() => {
    router.back()
  }, [router])

  if (state === "sent") {
    return (
      <View className="bg-background flex-1">
        <Stack.Screen options={{ headerShown: false }} />
        <StatusScreen
          icon={CheckCircle}
          iconColor="#22c55e"
          title="RFI Sent"
          description={`${MOCK_RFI_CONTENT.number} has been sent to ${MOCK_RFI_CONTENT.to}.`}
          action={{
            label: "Back to Project",
            onPress: handleBackToProject,
          }}
        />
      </View>
    )
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenLayout title="RFI" onBack={() => router.back()} scrollable={state !== "generating"}>
        {state === "context" && <ContextView onGenerate={handleGenerate} />}
        {state === "generating" && <GeneratingState />}
        {state === "draft" && (
          <DraftView onCopy={handleCopy} onShare={handleShareDraft} onSend={handleSend} />
        )}
      </ScreenLayout>

      <Toast message={toastMessage} visible={toastVisible} onDismiss={handleDismissToast} />
    </View>
  )
}

function ContextView({ onGenerate }: { onGenerate: () => void }) {
  return (
    <View className="gap-5 pt-4">
      <View>
        <Text className="text-foreground mb-3 text-base font-bold">Issue Evidence</Text>
        <View
          className="bg-muted/20 mb-4 items-center justify-center rounded-2xl"
          style={{ height: 200 }}
        >
          <Icon as={Camera} className="text-muted-foreground/40 size-10" />
          <Text className="text-muted-foreground mt-2 text-sm">Field photo - Grid A7</Text>
        </View>
      </View>

      <View className="bg-card border-border/20 rounded-2xl border p-4">
        <Text className="text-foreground mb-3 text-base font-bold">Issue Details</Text>
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="bg-muted/20 size-9 items-center justify-center rounded-full">
              <Icon as={MapPin} className="text-muted-foreground size-4" />
            </View>
            <View className="flex-1">
              <Text className="text-muted-foreground text-xs">Location</Text>
              <Text className="text-foreground text-sm font-medium">
                Grid A7, Foundation Plan S1.0
              </Text>
            </View>
          </View>

          <Divider />

          <View className="flex-row items-center gap-3">
            <View className="bg-muted/20 size-9 items-center justify-center rounded-full">
              <Icon as={Camera} className="text-muted-foreground size-4" />
            </View>
            <View className="flex-1">
              <Text className="text-muted-foreground text-xs">Photos</Text>
              <Text className="text-foreground text-sm font-medium">1 photo attached</Text>
            </View>
          </View>

          <Divider />

          <View className="flex-row items-center gap-3">
            <View className="bg-muted/20 size-9 items-center justify-center rounded-full">
              <Icon as={Mic} className="text-muted-foreground size-4" />
            </View>
            <View className="flex-1">
              <Text className="text-muted-foreground text-xs">Voice Notes</Text>
              <Text className="text-foreground text-sm font-medium">1 voice note (0:12)</Text>
            </View>
          </View>
        </View>
      </View>

      <Button className="h-12 w-full rounded-xl" onPress={onGenerate}>
        <Icon as={Sparkles} className="size-4 text-white" />
        <Text className="text-primary-foreground text-base font-semibold">Generate RFI</Text>
      </Button>
    </View>
  )
}

function DraftView({
  onCopy,
  onShare,
  onSend,
}: {
  onCopy: () => void
  onShare: () => void
  onSend: () => void
}) {
  return (
    <View className="gap-5 pt-2">
      <Badge variant="ai" size="default" className="self-start">
        <Icon as={Sparkles} className="mr-1 size-3 text-purple-500" />
        <Text>AI Generated</Text>
      </Badge>

      <View className="bg-card border-border/20 rounded-2xl border p-5">
        <View className="gap-3">
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground text-sm font-medium">RFI #</Text>
            <Text className="text-foreground text-sm font-bold">{MOCK_RFI_CONTENT.number}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground text-sm font-medium">Date</Text>
            <Text className="text-foreground text-sm">{MOCK_RFI_CONTENT.date}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground text-sm font-medium">To</Text>
            <Text className="text-foreground flex-1 text-right text-sm">{MOCK_RFI_CONTENT.to}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-muted-foreground text-sm font-medium">From</Text>
            <Text className="text-foreground text-sm">{MOCK_RFI_CONTENT.from}</Text>
          </View>
        </View>

        <Divider className="my-4" />

        <Text className="text-foreground mb-3 text-base font-bold">{MOCK_RFI_CONTENT.subject}</Text>

        <View className="gap-3">
          {MOCK_RFI_CONTENT.description.map((paragraph, i) => (
            <Text key={i} className="text-foreground text-sm leading-relaxed">
              {paragraph}
            </Text>
          ))}
        </View>

        <Divider className="my-4" />

        <Text className="text-foreground mb-2 text-sm font-bold">References</Text>
        <View className="gap-1.5">
          {MOCK_RFI_CONTENT.references.map((ref, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className="text-muted-foreground text-sm">{"\u2022"}</Text>
              <Text className="text-foreground flex-1 text-sm">{ref}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="gap-3 pb-4">
        <View className="flex-row gap-3">
          <Button variant="outline" className="h-11 flex-1 rounded-xl" onPress={onCopy}>
            <Icon as={Copy} className="text-foreground size-4" />
            <Text>Copy</Text>
          </Button>
          <Button variant="outline" className="h-11 flex-1 rounded-xl" onPress={onShare}>
            <Icon as={Share2} className="text-foreground size-4" />
            <Text>Share</Text>
          </Button>
        </View>
        <Button className="h-12 w-full rounded-xl" onPress={onSend}>
          <Icon as={Send} className="size-4 text-white" />
          <Text className="text-primary-foreground text-base font-semibold">Send RFI</Text>
        </Button>
      </View>
    </View>
  )
}
