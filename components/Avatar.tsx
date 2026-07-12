import { toInitials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  borderColor?: string;
}

const sizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-28 w-28 text-3xl"
};

export function Avatar({ name, src, size = "md", borderColor = "rgb(var(--color-line))" }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={`${sizes[size]} shrink-0 rounded-full border-2 object-cover`}
        style={{ borderColor }}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} grid shrink-0 place-items-center rounded-full border bg-court-elevated font-semibold text-white`}
      style={{ borderColor }}
      aria-hidden="true"
    >
      {toInitials(name)}
    </div>
  );
}
