import type { LucideIcon } from "lucide-react-native"
import * as React from "react"
import { Platform, TextInput, type TextInputProps, View } from "react-native"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

interface InputProps extends TextInputProps, React.RefAttributes<TextInput> {
  size?: "default" | "lg"
  error?: boolean
  leftIcon?: LucideIcon
  rightElement?: React.ReactNode
}

function Input({
  className,
  size = "default",
  error,
  leftIcon,
  rightElement,
  ...props
}: InputProps) {
  const sizeClass = size === "lg" ? "h-12 rounded-xl" : "h-10 rounded-md sm:h-9"

  if (leftIcon || rightElement) {
    return (
      <View className="relative">
        {leftIcon && (
          <View className="pointer-events-none absolute top-0 bottom-0 left-3 z-10 items-center justify-center">
            <Icon as={leftIcon} className="text-muted-foreground size-4" />
          </View>
        )}
        <TextInput
          placeholderTextColor="hsl(var(--muted-foreground))"
          className={cn(
            "dark:bg-muted/30 border-border/20 bg-background text-foreground flex w-full min-w-0 flex-row items-center border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5",
            sizeClass,
            leftIcon && "pl-10",
            rightElement && "pr-10",
            error && "border-destructive",
            props.editable === false &&
              cn(
                "opacity-50",
                Platform.select({
                  web: "disabled:pointer-events-none disabled:cursor-not-allowed",
                }),
              ),
            Platform.select({
              web: cn(
                "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground transition-[color,box-shadow] outline-none md:text-sm",
                !error &&
                  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                error && "ring-destructive/20 dark:ring-destructive/40 ring-[3px]",
              ),
              native: "placeholder:text-muted-foreground",
            }),
            className,
          )}
          {...props}
        />
        {rightElement && (
          <View className="absolute top-0 right-3 bottom-0 z-10 items-center justify-center">
            {rightElement}
          </View>
        )}
      </View>
    )
  }

  return (
    <TextInput
      placeholderTextColor="hsl(var(--muted-foreground))"
      className={cn(
        "dark:bg-muted/30 border-border/20 bg-background text-foreground flex w-full min-w-0 flex-row items-center border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5",
        sizeClass,
        error && "border-destructive",
        props.editable === false &&
          cn(
            "opacity-50",
            Platform.select({
              web: "disabled:pointer-events-none disabled:cursor-not-allowed",
            }),
          ),
        Platform.select({
          web: cn(
            "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground transition-[color,box-shadow] outline-none md:text-sm",
            !error &&
              "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            error && "ring-destructive/20 dark:ring-destructive/40 ring-[3px]",
          ),
          native: "placeholder:text-muted-foreground",
        }),
        className,
      )}
      {...props}
    />
  )
}

export { Input }
export type { InputProps }
