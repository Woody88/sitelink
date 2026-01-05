import * as React from 'react'
import { Animated, ViewProps } from 'react-native'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: ViewProps) {
  const opacity = React.useRef(new Animated.Value(0.3)).current

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [opacity])

  return (
    <Animated.View
      className={cn('rounded-md bg-muted', className)}
      style={[{ opacity }]}
      {...props}
    />
  )
}

export { Skeleton }

