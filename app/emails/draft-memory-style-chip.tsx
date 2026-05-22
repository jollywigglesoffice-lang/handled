"use client";

type DraftMemoryStyleChipProps = {
  label: string;
  detail?: string;
};

export function DraftMemoryStyleChip({ label, detail }: DraftMemoryStyleChipProps) {
  return (
    <div className="inline-flex max-w-full flex-col gap-0.5 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2">
      <p className="text-xs font-medium text-slate-700">{label}</p>
      {detail ? <p className="text-[10px] leading-snug text-slate-500">{detail}</p> : null}
    </div>
  );
}
