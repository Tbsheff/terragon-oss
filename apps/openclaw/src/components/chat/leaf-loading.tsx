import { memo } from "react";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

const LeafLoading = memo(function LeafLoading({
  message = "Loading",
  className,
}: {
  message?: string | React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 px-2 text-muted-foreground animate-fade-in",
        className,
      )}
    >
      <div className="animate-[sway_3s_ease-in-out_infinite] pt-1">
        <Leaf className="size-4" />
      </div>
      <span className="flex items-center gap-1 text-pretty text-sm">
        {message}
      </span>
    </div>
  );
});

export { LeafLoading };
