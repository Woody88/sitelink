import { useEffect } from 'react';
import { Redirect } from 'expo-router';

export default function Index() {
  // Placeholder auth logic - will be replaced with better-auth in Task 6
  // For now, redirect to main app
  const isAuthenticated = true; // TODO: Replace with actual auth check

  useEffect(() => {
    // Any initialization logic here
  }, []);

  if (isAuthenticated) {
    return <Redirect href="/(main)/projects" />;
  }

  return <Redirect href="/(auth)/login" />;
}
