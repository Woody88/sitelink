import React from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Tabs } from 'expo-router'
import { MoonStarIcon, SunIcon } from 'lucide-react-native'

import { NAV_THEME } from '@/lib/theme'
import { useClientOnlyValue } from '@/hooks/useClientOnlyValue'
import { Uniwind, useUniwind } from 'uniwind'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name']
  color: string
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />
}

const THEME_ICONS = {
  light: SunIcon,
  dark: MoonStarIcon,
}

function ThemeToggle() {
  const { theme } = useUniwind()

  function toggleTheme() {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    Uniwind.setTheme(newTheme)
  }

  return (
    <Button
      onPressIn={toggleTheme}
      size="icon"
      variant="ghost"
      className="ios:size-9 web:mx-4 rounded-full">
      <Icon as={THEME_ICONS[theme ?? 'light']} className="size-5" />
    </Button>
  )
}

export default function TabLayout() {
  const { theme } = useUniwind()
  const navTheme = NAV_THEME[theme ?? 'light']

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: navTheme.colors.primary,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        headerRight: () => <ThemeToggle />,
      }}>
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plans',
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
        }}
      />

      <Tabs.Screen
        name="project"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <TabBarIcon name="code" color={color} />,
        }}
      />
    </Tabs>
  )
}
