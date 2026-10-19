import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex w-fit max-w-full shrink-0 items-center justify-center gap-2 rounded-[10px] border text-base font-semibold whitespace-nowrap transition-transform outline-none select-none focus-visible:ring-3 focus-visible:ring-[#d01265]/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[#d01265] text-white hover:bg-[#d01265]",
        outline: "border-[#7a6580] bg-white text-[#1a1028] hover:bg-[#fff6fa]",
        secondary: "border-[#7a6580] bg-white text-[#1a1028] hover:bg-[#fff6fa]",
        ghost: "border-transparent bg-transparent text-[#1a1028] hover:bg-[#ffe8f3]",
        destructive: "border-transparent bg-[#9b1c3c] text-white hover:bg-[#9b1c3c]",
        link: "border-transparent bg-transparent text-[#d01265] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-11 px-3 text-sm",
        lg: "h-11 px-5",
        icon: "size-11 rounded-full p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
