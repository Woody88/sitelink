import * as React from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

export interface InputProps extends TextInputProps {
  className?: string;
}

const Input = React.forwardRef<TextInput, InputProps>(
  ({ className, placeholderTextColor, ...props }, ref) => {
    return (
      <TextInput
        ref={ref}
        className={cn(
          'h-14 w-full rounded-lg border border-input bg-background px-4 text-base text-foreground',
          'placeholder:text-muted-foreground',
          'focus:border-primary focus:ring-1 focus:ring-primary',
          'disabled:opacity-50',
          className
        )}
        placeholderTextColor={placeholderTextColor ?? '#71717a'}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
