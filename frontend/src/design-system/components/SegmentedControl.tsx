import * as Tabs from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: SegmentOption<T>[]
  onValueChange: (value: T) => void
  label: string
  className?: string
}

export function SegmentedControl<T extends string>({ value, options, onValueChange, label, className }: SegmentedControlProps<T>) {
  return (
    <Tabs.Root className="ds-segmented-root" value={value} onValueChange={(next) => onValueChange(next as T)}>
      <Tabs.List className={cn('ds-segmented', className)} aria-label={label}>
        {options.map((option) => (
          <Tabs.Trigger key={option.value} value={option.value} className="ds-segmented__item">
            {option.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  )
}
