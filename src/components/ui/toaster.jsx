import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

const ICONS = {
  success: CheckCircle2,
  destructive: XCircle,
  warning: AlertTriangle,
  info: Info,
  default: Info,
};

const ICON_COLORS = {
  success: "text-emerald-600",
  destructive: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
  default: "text-slate-500",
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant,
        ...props
      }) {
        const Icon = ICONS[variant] || ICONS.default;
        const iconColor = ICON_COLORS[variant] || ICON_COLORS.default;
        return (
          <Toast
            key={id}
            variant={variant}
            onClick={() => dismiss(id)}
            {...props}
          >
            <Icon className={`h-6 w-6 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="grid gap-1 flex-1 min-w-0">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action && (
              <div onClick={(e) => e.stopPropagation()}>{action}</div>
            )}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}