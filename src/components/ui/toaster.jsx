import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  // Immediately remove a toast (bypass queue)
  const removeToast = (id) => {
    dismiss(id);
  };

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, open, onOpenChange, duration, ...props }) {
        // Filter out non-DOM props before spreading
        return (
          <Toast key={id} data-state={open ? "open" : "closed"} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose onClick={() => removeToast(id)} />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
} 