import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'outline' | 'bare'
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { variant = 'outline', className, ...props }, ref,
) {
  return <input ref={ref} className={cn('ds-input', `ds-input--${variant}`, className)} {...props} />
})

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...props }, ref,
) {
  return <textarea ref={ref} className={cn('ds-textarea', className)} {...props} />
})
