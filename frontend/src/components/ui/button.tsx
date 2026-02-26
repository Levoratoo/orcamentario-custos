import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(180deg,var(--accent-2),var(--accent))] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_2px_6px_rgba(15,23,42,0.2),0_12px_26px_rgba(31,77,143,0.34)] hover:brightness-105 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_rgba(15,23,42,0.24),0_16px_34px_rgba(31,77,143,0.42)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/92 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/70",
        outline:
          "border border-border/80 bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-[color:var(--surface-2)] hover:text-foreground hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_4px_10px_rgba(15,23,42,0.1)] dark:bg-input/30 dark:border-input dark:hover:bg-input/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.45)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-secondary/90 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_10px_rgba(15,23,42,0.1)]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
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
