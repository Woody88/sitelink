import type { Meta, StoryObj } from "@storybook/react"
import { Camera, ChevronRight, Search } from "lucide-react-native"
import * as React from "react"
import { ScrollView, View } from "react-native"
import { StoryHeader } from "@/app/_story-components"
import { Icon } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"

function SheetListSkeleton() {
  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Sheets" />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        <View className="mb-4 mt-2">
          <View
            className="bg-muted/30 flex-row items-center rounded-xl px-3"
            style={{ height: 40 }}
          >
            <Icon as={Search} className="text-muted-foreground mr-2 size-4" />
            <Text className="text-muted-foreground flex-1 text-sm">Search sheets...</Text>
          </View>
        </View>

        <View className="gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              className="flex-row items-center gap-3 rounded-2xl px-4 py-4"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <Skeleton className="h-10 w-10 rounded-lg" />
              <View className="flex-1 gap-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-40 rounded" />
              </View>
              <Skeleton className="h-5 w-12 rounded-full" />
              <Icon
                as={ChevronRight}
                className="size-4"
                style={{ color: "rgba(255,255,255,0.1)" }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function ProjectListSkeleton() {
  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="Projects" />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-8">
        <View className="mb-4 mt-2">
          <View
            className="bg-muted/30 flex-row items-center rounded-xl px-3"
            style={{ height: 40 }}
          >
            <Icon as={Search} className="text-muted-foreground mr-2 size-4" />
            <Text className="text-muted-foreground flex-1 text-sm">Search projects...</Text>
          </View>
        </View>

        <View className="gap-4">
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              className="overflow-hidden rounded-2xl"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <Skeleton className="h-36 w-full" />
              <View className="gap-3 px-5 py-4">
                <Skeleton className="h-5 w-48 rounded" />
                <Skeleton className="h-3 w-56 rounded" />
                <View className="flex-row gap-4 pt-1">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

function PhotoTimelineSkeleton() {
  return (
    <View className="bg-background flex-1" style={{ minHeight: "100vh" } as any}>
      <StoryHeader title="5/A7 · Photos" />

      <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
        <View className="flex-row items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-3 w-10 rounded" />
        </View>
        <Skeleton className="h-3 w-16 rounded" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {[1, 2, 3].map((cluster) => (
          <View key={cluster} className="mb-2">
            <View className="px-4 pb-2 pt-4">
              <Skeleton className="h-3 w-32 rounded" />
            </View>
            <View className="gap-2 px-4">
              {[1, 2, 3].slice(0, cluster === 3 ? 2 : 3).map((photo) => (
                <View
                  key={photo}
                  className="flex-row overflow-hidden rounded-2xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                >
                  <Skeleton
                    className="h-[90px] w-[120px]"
                    style={{ borderTopLeftRadius: 16, borderBottomLeftRadius: 16 } as any}
                  />
                  <View className="flex-1 justify-center gap-2 px-3 py-2">
                    <Skeleton className="h-3 w-16 rounded" />
                    <Skeleton className="h-3 w-10 rounded" />
                  </View>
                  <View className="items-center justify-center pr-3">
                    <Icon
                      as={ChevronRight}
                      className="size-4"
                      style={{ color: "rgba(255,255,255,0.08)" }}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={{ position: "absolute", bottom: 24, right: 16, zIndex: 15 }}>
        <View
          className="items-center justify-center rounded-full"
          style={{ width: 56, height: 56, backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          <Icon as={Camera} className="size-6" style={{ color: "rgba(255,255,255,0.2)" }} />
        </View>
      </View>
    </View>
  )
}

function LoadingStatesComponent({
  variant = "sheets",
}: {
  variant?: "sheets" | "projects" | "photos"
}) {
  if (variant === "projects") return <ProjectListSkeleton />
  if (variant === "photos") return <PhotoTimelineSkeleton />
  return <SheetListSkeleton />
}

const meta: Meta<typeof LoadingStatesComponent> = {
  title: "Flows/Loading States",
  component: LoadingStatesComponent,
  parameters: { layout: "fullscreen" },
}

export default meta
type Story = StoryObj<typeof LoadingStatesComponent>

export const SheetList: Story = { name: "1. Sheet List Skeleton", args: { variant: "sheets" } }
export const ProjectList: Story = {
  name: "2. Project List Skeleton",
  args: { variant: "projects" },
}
export const PhotoTimeline: Story = {
  name: "3. Photo Timeline Skeleton",
  args: { variant: "photos" },
}
