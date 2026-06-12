import { accountBadgeLabel } from "@/lib/gmail/account-types";

export function AccountBadge({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const short = accountBadgeLabel(label);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border border-gray-200/80 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-gray-500 ${className}`}
    >
      {short}
    </span>
  );
}
