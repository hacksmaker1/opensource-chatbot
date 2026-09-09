import logo from "@/assets/nova-logo.png";
import { cn } from "@/lib/utils";

export function NovaMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <img
      src={logo}
      alt="Nova AI"
      width={size}
      height={size}
      className={cn("select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function NovaWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <NovaMark size={28} />
      <span className="font-display text-lg font-semibold tracking-tight">Nova</span>
    </span>
  );
}
