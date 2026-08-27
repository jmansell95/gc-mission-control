"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import useBackIntercept from "@/hooks/useBackIntercept"

const Drawer = ({
  shouldScaleBackground = true,
  open,
  onOpenChange,
  ...props
}) => {
  useBackIntercept(open, () => onOpenChange?.(false));
  return <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} open={open} onOpenChange={onOpenChange} {...props} />;
}
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-md", className)}
    {...props} />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

// Drawer now renders as a centered popup box (same as Dialog/Modal) for
// site-wide visual consistency. The drag handle is removed since it only
// makes sense for a bottom-attached sheet.
const DrawerContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 grid w-full gap-4 bg-background p-4 pt-14 overflow-y-auto overscroll-contain max-h-[100dvh]",
        "sm:left-[50%] sm:top-[50%] sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:border sm:border-slate-200/80 sm:p-10 sm:pt-8",
        "shadow-[0_8px_40px_-12px_rgba(15,23,42,0.25),0_4px_16px_-8px_rgba(15,23,42,0.15),0_0_0_1px_rgba(255,255,255,0.5)]",
        className
      )}
      {...props}>
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
))
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("grid gap-2 p-6 text-center sm:text-left", className)}
    {...props} />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-6", className)} {...props} />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-xl font-bold leading-tight tracking-tight text-slate-900", className)}
    {...props} />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props} />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}