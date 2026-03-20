import { Stack, useRouter } from "expo-router"
import {
  AlertTriangle,
  Camera,
  Cloud,
  FileText,
  Link,
  Mail,
  MessageSquare,
  Pencil,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react-native"
import * as React from "react"
import { Pressable, View } from "react-native"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Divider } from "@/components/ui/divider"
import { Icon } from "@/components/ui/icon"
import { ScreenLayout } from "@/components/ui/screen-layout"
import { Text } from "@/components/ui/text"
import { Toast } from "@/components/ui/toast"
import { MOCK_REPORT_TEXT, MOCK_SHARE_OPTIONS } from "@/lib/mock-data"

type FlowState = "prompt" | "generating" | "report" | "share"

const SHARE_ICONS = {
  Link,
  Mail,
  MessageSquare,
  FileText,
} as const

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
        style={{ width: 64, height: 64, backgroundColor: "rgba(168,85,247,0.1)" }}
      >
        <Icon as={Sparkles} className="size-8 text-purple-500" />
      </View>
      <Text className="text-foreground mb-2 text-lg font-bold">Generating Report...</Text>
      <Text className="text-muted-foreground mb-8 text-center text-sm">
        AI is analyzing today&apos;s field data...
      </Text>
      <View className="w-full gap-4">
        <SkeletonBar widthPercent={100} />
        <SkeletonBar widthPercent={85} />
        <SkeletonBar widthPercent={70} />
      </View>
    </View>
  )
}

export default function DailySummaryScreen() {
  const router = useRouter()
  const [state, setState] = React.useState<FlowState>("prompt")
  const [toastMessage, setToastMessage] = React.useState("")
  const [toastVisible, setToastVisible] = React.useState(false)

  const handleGenerate = React.useCallback(() => {
    setState("generating")
    setTimeout(() => setState("report"), 2000)
  }, [])

  const handleRegenerate = React.useCallback(() => {
    setState("generating")
    setTimeout(() => setState("report"), 2000)
  }, [])

  const handleShare = React.useCallback(() => {
    setState("share")
  }, [])

  const handleShareOption = React.useCallback((label: string) => {
    setState("report")
    setToastMessage(`${label} - Report shared successfully`)
    setToastVisible(true)
  }, [])

  const handleDismissToast = React.useCallback(() => {
    setToastVisible(false)
  }, [])

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ headerShown: false }} />

      <ScreenLayout
        title="Daily Summary"
        onBack={() => router.back()}
        scrollable={state !== "generating"}
      >
        {state === "prompt" && <PromptView onGenerate={handleGenerate} />}
        {state === "generating" && <GeneratingState />}
        {state === "report" && <ReportView onRegenerate={handleRegenerate} onShare={handleShare} />}
      </ScreenLayout>

      <BottomSheet
        visible={state === "share"}
        onClose={() => setState("report")}
        title="Share Report"
      >
        <View className="px-6 pb-8">
          {MOCK_SHARE_OPTIONS.map((option) => {
            const ShareIcon = SHARE_ICONS[option.icon as keyof typeof SHARE_ICONS] ?? FileText
            return (
              <Pressable
                key={option.id}
                onPress={() => handleShareOption(option.label)}
                className="active:bg-muted/30 flex-row items-center gap-4 rounded-xl py-3"
                style={{ minHeight: 48 }}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <View className="bg-muted/20 size-10 items-center justify-center rounded-full">
                  <Icon as={ShareIcon} className="text-foreground size-5" />
                </View>
                <Text className="text-foreground text-base font-medium">{option.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </BottomSheet>

      <Toast message={toastMessage} visible={toastVisible} onDismiss={handleDismissToast} />
    </View>
  )
}

function PromptView({ onGenerate }: { onGenerate: () => void }) {
  return (
    <View className="pt-4">
      <View className="bg-card border-border/20 rounded-2xl border p-5">
        <View className="mb-4 flex-row items-center gap-3">
          <View
            className="items-center justify-center rounded-xl"
            style={{
              width: 44,
              height: 44,
              backgroundColor: "rgba(168,85,247,0.1)",
            }}
          >
            <Icon as={Sparkles} className="size-5 text-purple-500" />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-lg font-bold">Generate Daily Report</Text>
            <Text className="text-muted-foreground text-sm">AI-powered field summary</Text>
          </View>
        </View>

        <Divider className="mb-4" />

        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-sm">Project</Text>
            <Text className="text-foreground text-sm font-medium">{MOCK_REPORT_TEXT.project}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-sm">Date</Text>
            <Text className="text-foreground text-sm font-medium">{MOCK_REPORT_TEXT.date}</Text>
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-sm">Weather</Text>
            <View className="flex-row items-center gap-1.5">
              <Icon as={Cloud} className="text-muted-foreground size-4" />
              <Text className="text-foreground text-sm font-medium">
                {MOCK_REPORT_TEXT.weather}
              </Text>
            </View>
          </View>
        </View>

        <Button className="mt-6 h-12 w-full rounded-xl" onPress={onGenerate}>
          <Icon as={Sparkles} className="size-4 text-white" />
          <Text className="text-primary-foreground text-base font-semibold">Generate Report</Text>
        </Button>
      </View>
    </View>
  )
}

function ReportView({ onRegenerate, onShare }: { onRegenerate: () => void; onShare: () => void }) {
  return (
    <View className="gap-5 pt-2">
      <Badge variant="ai" size="default" className="self-start">
        <Icon as={Sparkles} className="mr-1 size-3 text-purple-500" />
        <Text>AI Generated</Text>
      </Badge>

      <View>
        <Text className="text-foreground text-xl font-bold">{MOCK_REPORT_TEXT.project}</Text>
        <View className="mt-1 flex-row items-center gap-2">
          <Text className="text-muted-foreground text-sm">{MOCK_REPORT_TEXT.date}</Text>
          <Text className="text-muted-foreground text-sm">{MOCK_REPORT_TEXT.weather}</Text>
        </View>
      </View>

      <Divider />

      <View>
        <Text className="text-foreground mb-3 text-base font-bold">Work Performed</Text>
        <View className="gap-2.5">
          {MOCK_REPORT_TEXT.workPerformed.map((item, i) => (
            <View key={i} className="flex-row gap-2">
              <Text className="text-muted-foreground mt-0.5 text-sm">{"\u2022"}</Text>
              <Text className="text-foreground flex-1 text-sm leading-relaxed">{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <Divider />

      <View>
        <Text className="text-foreground mb-3 text-base font-bold">Issues & Delays</Text>
        <View className="gap-3">
          {MOCK_REPORT_TEXT.issues.map((issue, i) => (
            <View
              key={i}
              className="rounded-xl border border-red-500/20 p-4"
              style={{ backgroundColor: "rgba(239,68,68,0.03)" }}
            >
              <View className="flex-row items-start gap-2.5">
                <Icon as={AlertTriangle} className="mt-0.5 size-4 text-red-500" />
                <View className="flex-1 gap-1">
                  <Text className="text-foreground text-sm font-medium leading-snug">
                    {issue.text}
                  </Text>
                  <Text className="text-muted-foreground text-xs">{issue.location}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Divider />

      <View>
        <Text className="text-foreground mb-3 text-base font-bold">Photos</Text>
        <View className="flex-row flex-wrap gap-2">
          {MOCK_REPORT_TEXT.photos.map((photo, i) => (
            <View
              key={i}
              className="bg-muted/20 items-center justify-center rounded-xl"
              style={{ width: 80, height: 80 }}
            >
              <Icon
                as={Camera}
                className={`size-5 ${photo.isIssue ? "text-red-500" : "text-muted-foreground/40"}`}
              />
              <Text className="text-muted-foreground mt-1 text-[10px]">{photo.time}</Text>
            </View>
          ))}
        </View>
      </View>

      <Divider />

      <View className="gap-3 pb-4">
        <View className="flex-row gap-3">
          <Button variant="outline" className="h-11 flex-1 rounded-xl" onPress={onRegenerate}>
            <Icon as={RefreshCw} className="text-foreground size-4" />
            <Text>Regenerate</Text>
          </Button>
          <Button variant="outline" className="h-11 flex-1 rounded-xl" onPress={() => {}}>
            <Icon as={Pencil} className="text-foreground size-4" />
            <Text>Edit</Text>
          </Button>
        </View>
        <View className="flex-row gap-3">
          <Button className="h-11 flex-1 rounded-xl" onPress={onShare}>
            <Icon as={Share2} className="size-4 text-white" />
            <Text className="text-primary-foreground font-semibold">Share</Text>
          </Button>
          <Button variant="outline" className="h-11 flex-1 rounded-xl" onPress={() => {}}>
            <Icon as={FileText} className="text-foreground size-4" />
            <Text>Export PDF</Text>
          </Button>
        </View>
      </View>
    </View>
  )
}
