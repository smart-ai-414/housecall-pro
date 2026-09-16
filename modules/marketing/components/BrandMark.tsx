import { cn } from "@/core/utils/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="7" fill="#254F5D" />
      <path
        d="M9 22.5 16 8l7 14.5"
        stroke="#8DBAC4"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12.2 17h7.6"
        stroke="#B8842A"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
