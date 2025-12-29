import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { authClient } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt: Date;
}

export default function OrgsScreen() {
  const insets = useSafeAreaInsets();
  const {
    organization: activeOrg,
    setActiveOrganization,
    isLoading: authLoading,
  } = useAuth();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    activeOrg?.id ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch organizations
  useEffect(() => {
    async function fetchOrgs() {
      try {
        const result = await authClient.organization.list();
        if (result.data) {
          setOrganizations(result.data as Organization[]);
        }
      } catch (err) {
        console.error("[OrgsScreen] Error fetching organizations:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrgs();
  }, []);

  // Update selection when active org changes
  useEffect(() => {
    if (activeOrg?.id) {
      setSelectedOrgId(activeOrg.id);
    }
  }, [activeOrg?.id]);

  const handleOrgPress = useCallback((org: Organization) => {
    setSelectedOrgId(org.id);
  }, []);

  const handleContinue = useCallback(async () => {
    if (!selectedOrgId) return;

    setIsSubmitting(true);
    try {
      await setActiveOrganization(selectedOrgId);
      router.replace("/(main)/projects");
    } catch (err) {
      console.error("[OrgsScreen] Error setting organization:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedOrgId, setActiveOrganization]);

  if (isLoading || authLoading) {
    return (
      <View
        className="flex-1 bg-background items-center justify-center"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#c9623d" />
        <Text className="mt-4 text-muted-foreground">
          Loading organizations...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View
        className="bg-background border-b border-slate-200 z-20"
        style={{ paddingTop: insets.top }}
      >
        <View className="px-4 py-6">
          <Text className="text-2xl font-bold text-foreground text-center">
            Select Organization
          </Text>
          <Text className="text-sm text-muted-foreground text-center mt-2">
            Choose which organization you want to work with
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View className="gap-3">
          {organizations.map((org) => (
            <Pressable
              key={org.id}
              onPress={() => handleOrgPress(org)}
              className="w-full"
            >
              <View
                className={cn(
                  "flex-row items-center justify-between w-full p-4 bg-white rounded-xl",
                  selectedOrgId === org.id
                    ? "border-2 border-primary shadow-md"
                    : "border border-slate-200"
                )}
              >
                {/* Org icon */}
                <View className="w-12 h-12 rounded-full bg-accent items-center justify-center mr-4">
                  <Ionicons name="business" size={24} color="#c9623d" />
                </View>

                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">
                    {org.name}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    @{org.slug}
                  </Text>
                </View>

                {/* Selection indicator */}
                <View className="shrink-0">
                  {selectedOrgId === org.id ? (
                    <View className="w-7 h-7 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={18} color="#ffffff" />
                    </View>
                  ) : (
                    <View className="w-7 h-7 rounded-full border-2 border-slate-300" />
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 border-t border-slate-200 z-30"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
      >
        <Pressable
          onPress={handleContinue}
          disabled={!selectedOrgId || isSubmitting}
          className={cn(
            "w-full flex-row items-center justify-center gap-3 h-14 rounded-xl shadow-lg",
            selectedOrgId && !isSubmitting
              ? "bg-primary active:opacity-90"
              : "bg-primary/50"
          )}
          style={{
            shadowColor: "#c9623d",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 15,
            elevation: 8,
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Text className="text-lg font-bold tracking-tight text-white">
                Continue
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
