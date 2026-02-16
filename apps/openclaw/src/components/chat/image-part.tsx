import { cn } from "@/lib/utils";

export function ImagePart({
  imageUrl,
  alt,
  onClick,
  className,
}: {
  imageUrl: string;
  alt?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <img
      src={imageUrl}
      alt={alt || "Image"}
      className={cn(
        "max-w-[200px] cursor-pointer rounded-md border border-border/50 object-cover",
        className,
      )}
      onClick={onClick}
    />
  );
}
