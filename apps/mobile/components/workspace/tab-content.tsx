import { View } from 'react-native'

interface TabContentProps {
  activeTab: number
  children: React.ReactNode[]
}

export function TabContent({ activeTab, children }: TabContentProps) {
  return (
    <View className="flex-1">
      {children.map((child, index) => (
        <View
          key={index}
          className="flex-1 absolute inset-0"
          style={{ display: activeTab === index ? 'flex' : 'none' }}
        >
          {child}
        </View>
      ))}
    </View>
  )
}
