import { cn } from "@/lib/utils";

type WordmarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: { badge: "size-5 text-[10px]", text: "text-sm" },
  md: { badge: "size-7 text-xs", text: "text-sm" },
  lg: { badge: "size-8 text-sm", text: "text-base" },
};

export function Wordmark({ size = "md", className }: WordmarkProps) {
  const s = sizes[size];

  return (
    <div
      className={cn(
        "flex items-center gap-2 transition-transform duration-200 hover:scale-[1.02]",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-primary font-bold text-primary-foreground",
          s.badge,
        )}
      >
        OC
      </div>
      <span
        className={cn(
          "font-[var(--font-cabin)] font-extrabold text-foreground group-data-[collapsible=icon]:hidden",
          s.text,
        )}
      >
        OpenClaw
      </span>
    </div>
  );
}
