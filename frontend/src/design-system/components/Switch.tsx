import * as SwitchPrimitive from '@radix-ui/react-switch'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export function Switch({ checked, onCheckedChange, label, disabled }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className="ds-switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      disabled={disabled}
    >
      <SwitchPrimitive.Thumb className="ds-switch__thumb" />
    </SwitchPrimitive.Root>
  )
}
