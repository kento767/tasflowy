"use client";

import type { TreeNode } from "@/lib/types";
import { DuePill, StatusChip } from "./pills";

interface RootSidebarProps {
  roots: TreeNode[];
  onGo: (id: string) => void;
  onAddRoot: () => void;
  onClose: () => void;
}

export function RootSidebar({ roots, onGo, onAddRoot, onClose }: RootSidebarProps) {
  const sorted = [...roots].sort((a, b) =>
    (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31")
  );

  return (
    <div className="w-[264px] flex-none overflow-auto border-r border-divider bg-n100 px-[22px] py-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs tracking-[3px] text-n600">根タスク ─ 期限順</span>
        <button
          type="button"
          onClick={onClose}
          title="閉じる"
          className="inline-flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-full text-[15px] leading-none text-n600 hover:bg-n200 hover:text-n900"
        >
          ×
        </button>
      </div>
      <div className="flex flex-col gap-[10px]">
        {sorted.map((r) => (
          <div
            key={r.id}
            onClick={() => onGo(r.id)}
            className="flex h-[68px] cursor-pointer flex-col justify-center gap-[6px] rounded-2xl border border-n400 bg-white px-[14px] shadow-card hover:bg-n100"
          >
            <div className="truncate text-[15px] leading-[1.25] font-bold text-n900">
              {r.title}
            </div>
            <div className="flex items-center gap-[6px]">
              {r.status === "active" && <StatusChip />}
              {r.due_date && <DuePill due={r.due_date} />}
            </div>
          </div>
        ))}
      </div>
      <div
        onClick={onAddRoot}
        className="flex cursor-pointer items-center gap-2 px-[2px] py-3 text-[13px] text-accent-700 hover:text-accent"
      >
        <span className="text-[15px] leading-none">＋</span> 根タスクを追加
      </div>
      <div className="mt-2 text-xs leading-[1.7] text-n600">
        期限の近い順に並びます。ノードの「＋」から子タスクを追加できます。
      </div>
    </div>
  );
}
