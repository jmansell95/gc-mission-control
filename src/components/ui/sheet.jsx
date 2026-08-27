"use client";
import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva } from "class-variance-authority";
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import useBackIntercept from "@/hooks/useBackIntercept"

const Sheet = ({ open, onOpenChange, ...props }) => {
  useBackIntercept(open, () => onOpenChange?.(false));
  return <SheetPrimitive.Root open={open} onOpenChange={onOpenChange} {...props} />;
}

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref} />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

// All Sheet variants now render as a centered popup box (same as Dialog).
// The `side` prop is kept for backward compatibility but no longer affects
// positioning — every drawer is a centered modal for visual consistency.
const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
  {
    variants: {
      side: {
        top: "",
        bottom: "",
        left: "",
        right: "",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

const SheetContent = React.forwardRef(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(
        sheetVariants({ side }),
        // Centered popup box — identical to DialogContent for site-wide consistency
        "inset-0 grid w-full p-4 pt-14 overflow-y-auto overscroll-contain max-h-[100dvh]",
        "sm:left-[50%] sm:top-[50%] sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:p-10 sm:pt-8",
        "shadow-[0_8px_40px_-12px_rgba(15,23,42,0.25),0_4px_16px_-8px_rgba(15,23,42,0.15),0_0_0_1px_rgba(255,255,255,0.5)]",
        className
      )}
      {...props}>
      <SheetPrimitive.Close
        className="absolute right-4 top-4 z-10 rounded-xl p-2 bg-slate-100/80 text-slate-500 ring-offset-background backdrop-blur-sm transition-all hover:scale-110 hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none shadow-sm">
        <X className="h-5 w-5" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3", className)}
    {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-xl font-bold text-foreground tracking-tight", className)}
    {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}