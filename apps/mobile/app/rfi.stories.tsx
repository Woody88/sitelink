import type { Meta, StoryObj } from "@storybook/react"
import { AlertTriangle, Copy, Edit2, FileText, Share2, Sparkles } from "lucide-react-native"
import * as React from "react"
import { ScrollView, View } from "react-native"
import { StoryHeader, StoryToast } from "@/app/_story-components"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"

const RFI_CONTENT = {
  number: "RFI-2026-0047",
  date: "March 9, 2026",
  project: "Holabird Ave Warehouse",
  to: "Thompson Structural Engineers",
  from: "John Smith, Smith Electrical LLC",
  subject: "Concrete Strength Discrepancy \u2014 SL1 vs General Note N3",
  description: [
    "During review of the Slab on Grade Schedule on Sheet S1.0, entry SL1 specifies a concrete strength of 4000 PSI. However, General Structural Note N3 on the same sheet states that \u201call exposed slab-on-grade shall achieve minimum 4500 PSI 28-day compressive strength.\u201d",
    "Please clarify which specification governs for the SL1 slab areas, and whether the schedule should be updated to reflect the 4500 PSI requirement from the general notes.",
  ],
  references: [
    "Sheet S1.0, Slab on Grade Schedule, Entry SL1",
    "Sheet S1.0, General Structural Notes, Note N3",
  ],
}

function ContextCard() {
  return (
    <View
      className="overflow-hidden rounded-2xl"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <View className="gap-3 px-5 py-4">
        <View className="flex-row items-center gap-3">
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 36,
              height: 36,
              backgroundColor: "rgba(245,158,11,0.12)",
            }}
          >
            <Icon as={AlertTriangle} className="size-4" style={{ color: "#f59e0b" }} />
          </View>
          <Text className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            Source
          </Text>
        </View>

        <Text className="text-foreground text-base font-bold">Concrete Strength Discrepancy</Text>

        <Text className="text-muted-foreground text-sm leading-relaxed">
          Slab on Grade Schedule entry SL1 specifies 4000 PSI, but General Structural Note N3
          requires 4500 PSI minimum for exposed slabs
        </Text>

        <View className="flex-row items-center gap-2">
          <Icon as={FileText} className="text-muted-foreground size-3.5" />
          <Text className="text-muted-foreground text-xs">S1.0 - Foundation Plan</Text>
        </View>
      </View>
    </View>
  )
}

function LoadingState() {
  return (
    <View className="gap-4 py-6">
      <View className="items-center gap-3 pb-2">
        <Icon as={Sparkles} className="size-6" style={{ color: "#a855f7" }} />
        <Text className="text-sm font-medium" style={{ color: "#a855f7" }}>
          AI is drafting your RFI...
        </Text>
      </View>

      <View
        className="overflow-hidden rounded-2xl px-5 py-5"
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <View className="gap-4">
          <Skeleton className="h-6 w-3/4 rounded" />
          <View className="gap-2">
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-2/5 rounded" />
            <Skeleton className="h-4 w-3/5 rounded" />
          </View>
          <View className="pt-2">
            <Skeleton className="h-4 w-1/3 rounded" />
          </View>
          <View className="gap-2 pt-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-4/5 rounded" />
          </View>
          <View className="gap-2 pt-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/5 rounded" />
          </View>
          <View className="gap-2 pt-2">
            <Skeleton className="h-4 w-1/4 rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
          </View>
        </View>
      </View>
    </View>
  )
}

function RfiLetterField({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row">
      <Text className="text-muted-foreground w-16 text-xs font-semibold">{label}</Text>
      <Text className="text-foreground flex-1 text-xs">{value}</Text>
    </View>
  )
}

function GeneratedRfi() {
  return (
    <View className="gap-4 py-4">
      <View
        className="overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)",
        }}
      >
        <View
          className="flex-row items-center gap-2 px-5 py-3"
          style={{ backgroundColor: "rgba(168,85,247,0.08)" }}
        >
          <Icon as={Sparkles} className="size-4" style={{ color: "#a855f7" }} />
          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: "#a855f7" }}>
            AI-Generated Draft
          </Text>
        </View>

        <View className="gap-5 px-5 py-5">
          <Text className="text-foreground text-center text-lg font-black tracking-wide">
            REQUEST FOR INFORMATION
          </Text>

          <View className="gap-1.5">
            <RfiLetterField label="RFI No:" value={RFI_CONTENT.number} />
            <RfiLetterField label="Date:" value={RFI_CONTENT.date} />
            <RfiLetterField label="Project:" value={RFI_CONTENT.project} />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />

          <View className="gap-1.5">
            <RfiLetterField label="To:" value={RFI_CONTENT.to} />
            <RfiLetterField label="From:" value={RFI_CONTENT.from} />
            <RfiLetterField label="Subject:" value={RFI_CONTENT.subject} />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />

          <View className="gap-2">
            <Text className="text-foreground text-xs font-bold uppercase tracking-wider">
              Description
            </Text>
            {RFI_CONTENT.description.map((paragraph) => (
              <Text
                key={paragraph.slice(0, 40)}
                className="text-foreground text-sm leading-relaxed"
              >
                {paragraph}
              </Text>
            ))}
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />

          <View className="gap-2">
            <Text className="text-foreground text-xs font-bold uppercase tracking-wider">
              Reference
            </Text>
            {RFI_CONTENT.references.map((ref) => (
              <View key={ref} className="flex-row gap-2">
                <Text className="text-muted-foreground text-sm">{"\u2022"}</Text>
                <Text className="text-foreground flex-1 text-sm leading-relaxed">{ref}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

function ActionButtons({ onShowToast }: { onShowToast?: (msg: string) => void }) {
  return (
    <View className="gap-3 pt-2 pb-4">
      <Button className="h-12 rounded-xl" onPress={() => onShowToast?.("Opening editor...")}>
        <Icon as={Edit2} className="text-primary-foreground mr-2 size-5" />
        <Text className="text-primary-foreground text-base font-semibold">Edit Draft</Text>
      </Button>
      <View className="flex-row gap-3">
        <Button
          variant="secondary"
          className="h-12 flex-1 rounded-xl"
          onPress={() => onShowToast?.("RFI copied to clipboard")}
        >
          <Icon as={Copy} className="text-secondary-foreground mr-2 size-4" />
          <Text className="text-secondary-foreground text-sm font-semibold">Copy to Clipboard</Text>
        </Button>
        <Button
          variant="secondary"
          className="h-12 flex-1 rounded-xl"
          onPress={() => onShowToast?.("Share link created")}
        >
          <Icon as={Share2} className="text-secondary-foreground mr-2 size-4" />
          <Text className="text-secondary-foreground text-sm font-semibold">Share</Text>
        </Button>
      </View>
    </View>
  )
}

type RfiState = "idle" | "loading" | "generated"

export function RfiDraftScreen({
  initialState = "idle",
  onBack,
}: {
  initialState?: RfiState
  onBack?: () => void
}) {
  const [state, setState] = React.useState<RfiState>(initialState)
  const [toastMsg, setToastMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (state !== "loading") return
    const timer = setTimeout(() => setState("generated"), 3000)
    return () => clearTimeout(timer)
  }, [state])

  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Generate RFI" onBack={onBack} />

      <View className="px-4 pt-2">
        <Badge
          variant="secondary"
          className="self-start border-transparent"
          style={{ backgroundColor: "rgba(168,85,247,0.12)" }}
        >
          <Text className="text-[10px] font-bold" style={{ color: "#a855f7" }}>
            BUSINESS FEATURE
          </Text>
        </Badge>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-4">
          <ContextCard />
        </View>

        {state === "idle" && (
          <View className="pt-6">
            <Button className="h-14 rounded-xl" onPress={() => setState("loading")}>
              <Icon as={Sparkles} className="text-primary-foreground mr-2 size-5" />
              <Text className="text-primary-foreground text-base font-semibold">
                Generate RFI Draft
              </Text>
            </Button>
          </View>
        )}

        {state === "loading" && <LoadingState />}

        {state === "generated" && (
          <>
            <GeneratedRfi />
            <ActionButtons onShowToast={setToastMsg} />
          </>
        )}
      </ScrollView>
      <StoryToast
        message={toastMsg ?? ""}
        visible={!!toastMsg}
        onDismiss={() => setToastMsg(null)}
      />
    </View>
  )
}

const meta: Meta<typeof RfiDraftScreen> = {
  title: "Screens/RFI Draft",
  component: RfiDraftScreen,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof RfiDraftScreen>

export const Default: Story = {}

export const Generated: Story = {
  args: { initialState: "generated" },
}
