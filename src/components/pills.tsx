import { duePillInfo, type DueKind } from "@/lib/date";

const KIND_CLASS: Record<DueKind, string> = {
  overdue: "bg-overdue text-badge-light",
  soon: "bg-soon text-badge-light",
  far: "bg-far text-far-text",
};

/** 期限バッジ(超過/今日・3日以内/余裕で色分け) */
export function DuePill({ due }: { due: string }) {
  const p = duePillInfo(due);
  return (
    <span
      className={`inline-block rounded-full px-[7px] py-px text-[10.5px] leading-[15px] font-bold whitespace-nowrap ${KIND_CLASS[p.kind]}`}
    >
      {p.text}
    </span>
  );
}

/** 「進行中」チップ(淡青ピル) */
export function StatusChip() {
  return (
    <span className="inline-block rounded-full bg-accent-100 px-[7px] py-px text-[10.5px] leading-[15px] font-bold whitespace-nowrap text-chip-blue">
      進行中
    </span>
  );
}

/** 「次にやる」チップ(白地アウトラインピル) */
export function NextChip() {
  return (
    <span className="rounded-full border border-n400 bg-white px-[7px] text-[10.5px] leading-[15px] font-medium whitespace-nowrap text-n600">
      次にやる
    </span>
  );
}
