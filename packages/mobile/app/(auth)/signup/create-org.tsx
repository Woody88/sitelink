import { useState } from "react";
import {
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  HardHat,
  Hammer,
  Ruler,
  Building2,
} from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useRedirectIfAuthenticated } from "@/lib/auth-context";
import {
  StepIndicator,
  IndustryCard,
  TeamSizeButton,
  type IndustryType,
  type TeamSize,
} from "@/components/signup";
import { cn } from "@/lib/utils";

// Store org data temporarily for the signup flow
export interface OrgData {
  name: string;
  industryType: IndustryType | null;
  teamSize: TeamSize | null;
}

// We'll use a simple module-level storage for the flow
let signupOrgData: OrgData = {
  name: "",
  industryType: null,
  teamSize: null,
};

export function getSignupOrgData() {
  return signupOrgData;
}

export function setSignupOrgData(data: OrgData) {
  signupOrgData = data;
}

export function clearSignupOrgData() {
  signupOrgData = {
    name: "",
    industryType: null,
    teamSize: null,
  };
}

export default function CreateOrgScreen() {
  const insets = useSafeAreaInsets();
  const [orgName, setOrgName] = useState(signupOrgData.name);
  const [industryType, setIndustryType] = useState<IndustryType | null>(
    signupOrgData.industryType
  );
  const [teamSize, setTeamSize] = useState<TeamSize | null>(
    signupOrgData.teamSize
  );
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useRedirectIfAuthenticated();

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    setError(null);

    if (!orgName.trim()) {
      setError("Please enter your organization name");
      return;
    }

    if (!industryType) {
      setError("Please select your industry type");
      return;
    }

    if (!teamSize) {
      setError("Please select your team size");
      return;
    }

    // Save org data for next step
    setSignupOrgData({
      name: orgName.trim(),
      industryType,
      teamSize,
    });

    // Navigate to create account step
    router.push("/(auth)/signup/create-account");
  };

  return (
    <LinearGradient
      colors={["#f9f7f2", "#f0ebe0", "#e8e2d4"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className="flex-1"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header with safe area inset */}
        <View
          className="flex-row items-center justify-between px-4 pb-4"
          style={{ paddingTop: insets.top + 8 }}
        >
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 items-center justify-center rounded-full bg-white/70 border border-border"
            >
              <ArrowLeft size={20} color="#3d3929" strokeWidth={2} />
            </Pressable>
            <Text className="text-lg font-semibold text-foreground">
              Sign Up
            </Text>
            <View className="w-10" />
          </View>

          {/* Step Indicator */}
          <View className="py-4">
            <StepIndicator currentStep={1} />
          </View>

          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            {/* Title Section */}
            <View className="px-6 pb-6">
              <Text className="text-2xl font-bold text-foreground text-center">
                Create Organization
              </Text>
              <Text className="text-muted-foreground text-center mt-2">
                Set up your company workspace to start managing plans on the
                site.
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View className="mx-6 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <Text className="text-red-600 text-sm text-center">
                  {error}
                </Text>
              </View>
            )}

            {/* Form */}
            <View className="px-6 gap-6">
              {/* Organization Name */}
              <View className="gap-2">
                <Text className="text-foreground text-sm font-semibold ml-1">
                  Organization Name
                </Text>
                <TextInput
                  className="h-14 px-4 rounded-xl border border-border bg-white text-foreground text-base"
                  placeholder="e.g. Acme Construction"
                  placeholderTextColor="#828180"
                  value={orgName}
                  onChangeText={setOrgName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>

              {/* Industry Type */}
              <View className="gap-3">
                <Text className="text-foreground text-sm font-semibold ml-1">
                  Industry Type
                </Text>
                <View className="flex-row gap-3">
                  <IndustryCard
                    icon={<HardHat size={28} color={industryType === "general_contractor" ? "#c9623d" : "#3d3929"} strokeWidth={1.5} />}
                    label="General Contractor"
                    value="general_contractor"
                    selected={industryType === "general_contractor"}
                    onSelect={setIndustryType}
                  />
                  <IndustryCard
                    icon={<Hammer size={28} color={industryType === "subcontractor" ? "#c9623d" : "#3d3929"} strokeWidth={1.5} />}
                    label="Subcontractor"
                    value="subcontractor"
                    selected={industryType === "subcontractor"}
                    onSelect={setIndustryType}
                  />
                </View>
                <View className="flex-row gap-3">
                  <IndustryCard
                    icon={<Ruler size={28} color={industryType === "architect_engineer" ? "#c9623d" : "#3d3929"} strokeWidth={1.5} />}
                    label="Architect / Engineer"
                    value="architect_engineer"
                    selected={industryType === "architect_engineer"}
                    onSelect={setIndustryType}
                  />
                  <IndustryCard
                    icon={<Building2 size={28} color={industryType === "owner_developer" ? "#c9623d" : "#3d3929"} strokeWidth={1.5} />}
                    label="Owner / Developer"
                    value="owner_developer"
                    selected={industryType === "owner_developer"}
                    onSelect={setIndustryType}
                  />
                </View>
              </View>

              {/* Team Size */}
              <View className="gap-3">
                <Text className="text-foreground text-sm font-semibold ml-1">
                  Team Size
                </Text>
                <View className="flex-row gap-3">
                  <TeamSizeButton
                    label="1-10"
                    value="1-10"
                    selected={teamSize === "1-10"}
                    onSelect={setTeamSize}
                  />
                  <TeamSizeButton
                    label="11-50"
                    value="11-50"
                    selected={teamSize === "11-50"}
                    onSelect={setTeamSize}
                  />
                  <TeamSizeButton
                    label="50+"
                    value="50+"
                    selected={teamSize === "50+"}
                    onSelect={setTeamSize}
                  />
                  <TeamSizeButton
                    label="Ent."
                    value="enterprise"
                    selected={teamSize === "enterprise"}
                    onSelect={setTeamSize}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

        {/* Fixed Bottom Button */}
        <View
          className="absolute bottom-0 left-0 right-0 px-6 pt-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
            <Pressable
              onPress={handleContinue}
              className={cn(
                "flex-row h-14 items-center justify-center gap-2 rounded-xl bg-primary",
                "active:opacity-90"
              )}
              style={{
                shadowColor: "#c9623d",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.25,
                shadowRadius: 15,
                elevation: 8,
              }}
            >
              <Text className="text-white text-base font-bold tracking-wide">
                Create Organization
              </Text>
              <ArrowRight size={20} color="#ffffff" strokeWidth={2.5} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
