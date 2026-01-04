import * as React from 'react'
import { View } from 'react-native'
import { cn } from '@/lib/utils'

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

const Separator = React.forwardRef<View, SeparatorProps>(
  ({ orientation = 'horizontal', className, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn(
          'bg-border shrink-0',
          orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
          className
        )}
        {...props}
      />
    )
  }
)

Separator.displayName = 'Separator'

export { Separator }

