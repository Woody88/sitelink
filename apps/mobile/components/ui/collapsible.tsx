import * as React from 'react';
import * as CollapsiblePrimitive from '@rn-primitives/collapsible';
import { cn } from '@/lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

const CollapsibleTrigger = CollapsiblePrimitive.Trigger;

const CollapsibleContent = React.forwardRef<
  CollapsiblePrimitive.ContentRef,
  CollapsiblePrimitive.ContentProps
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn('overflow-hidden', className)}
    {...props}
  />
));
CollapsibleContent.displayName = CollapsiblePrimitive.Content.displayName;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };

