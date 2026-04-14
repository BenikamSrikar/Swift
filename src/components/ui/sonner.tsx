import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:shadow-2xl group-[.toaster]:border group-[.toaster]:border-border/50 group-[.toaster]:backdrop-blur-xl group-[.toaster]:bg-card/95 group-[.toaster]:text-foreground group-[.toaster]:px-4 group-[.toaster]:py-3",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          success:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-green-500 group-[.toaster]:bg-card/95",
          error:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-red-500 group-[.toaster]:bg-card/95",
          info:
            "group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-blue-400 group-[.toaster]:bg-card/95",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
