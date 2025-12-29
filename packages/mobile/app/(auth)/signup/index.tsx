import { Redirect } from "expo-router";

export default function SignupIndex() {
  // Redirect to the first step of the signup flow
  return <Redirect href="/(auth)/signup/create-org" />;
}
