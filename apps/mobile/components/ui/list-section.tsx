import * as React from "react"
import { View, type ViewProps } from "react-native"
import { Divider } from "@/components/ui/divider"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

interface ListSectionProps extends ViewProps {
  title?: string
  dividerInset?: number
}

function ListSection({
  title,
  dividerInset = 16,
  children,
  className,
  ...props
}: ListSectionProps) {
  const items = React.Children.toArray(children).filter(Boolean)

  return (
    <View className={cn("pt-6", className)} {...props}>
      {title && (
        <Text className="text-muted-foreground mb-1 px-4 text-xs font-bold tracking-wider uppercase">
          {title}
        </Text>
      )}
      <View className="bg-surface-1 overflow-hidden rounded-xl">
        {items.map((child, index) => (
          <React.Fragment key={index}>
            {index > 0 && <Divider inset={dividerInset} />}
            {child}
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

export { ListSection }
export type { ListSectionProps }
