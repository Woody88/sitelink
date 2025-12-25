import { Drawer } from 'expo-router/drawer';

export default function DrawerLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        drawerActiveTintColor: '#2563eb',
        drawerInactiveTintColor: '#6b7280',
      }}
    >
      <Drawer.Screen 
        name="projects/index" 
        options={{ 
          title: 'Projects',
          drawerLabel: 'Projects',
        }} 
      />
      <Drawer.Screen 
        name="settings/index" 
        options={{ 
          title: 'Settings',
          drawerLabel: 'Settings',
        }} 
      />
    </Drawer>
  );
}

