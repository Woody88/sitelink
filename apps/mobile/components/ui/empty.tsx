import * as React from 'react'
import { View, ViewProps, TextProps as RNTextProps } from 'react-native'
import { Text } from '@/components/ui/text'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Empty state component following shadcn/ui pattern
 * @see https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/new-york-v4/ui/empty.tsx
 */

function Empty({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'flex-1 items-center justify-center gap-6 rounded-lg border border-dashed border-border/30 p-6',
        className
      )}
      {...props}
    >
      {children}
    </View>
  )
}

function EmptyHeader({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'max-w-[320px] items-center gap-2',
        className
      )}
      {...props}
    >
      {children}
    </View>
  )
}

const emptyMediaVariants = cva(
  'shrink-0 items-center justify-center mb-2',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        icon: 'bg-muted size-10 shrink-0 items-center justify-center rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface EmptyMediaProps extends ViewProps, VariantProps<typeof emptyMediaVariants> {}

function EmptyMedia({ className, variant = 'default', children, ...props }: EmptyMediaProps) {
  return (
    <View
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    >
      {children}
    </View>
  )
}

interface EmptyTitleProps extends RNTextProps {
  className?: string
  children?: React.ReactNode
}

function EmptyTitle({ className, children, ...props }: EmptyTitleProps) {
  return (
    <Text
      className={cn(
        'text-lg font-medium tracking-tight text-foreground text-center',
        className
      )}
      {...props}
    >
      {children}
    </Text>
  )
}

interface EmptyDescriptionProps extends RNTextProps {
  className?: string
  children?: React.ReactNode
}

function EmptyDescription({ className, children, ...props }: EmptyDescriptionProps) {
  return (
    <Text
      className={cn(
        'text-sm text-muted-foreground text-center leading-relaxed',
        className
      )}
      {...props}
    >
      {children}
    </Text>
  )
}

function EmptyContent({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'w-full max-w-[320px] items-center gap-4',
        className
      )}
      {...props}
    >
      {children}
    </View>
  )
}

export {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
}

