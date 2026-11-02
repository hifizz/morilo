import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  label: string
  className?: string
}

export function Select({ value, onValueChange, options, label, className = '' }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger className={`ds-select ${className}`} aria-label={label}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon><ChevronDown size={14} /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="ds-select-content" position="popper" sideOffset={5}>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value} className="ds-select-item">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator><Check size={14} /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
