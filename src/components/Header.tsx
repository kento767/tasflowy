"use client";

import { useEffect, useState } from "react";
import { headerDateLabel } from "@/lib/date";

export function Header() {
  // 日付はタイムゾーン差でSSRとズレうるため、マウント後に表示する
  const [dateLabel, setDateLabel] = useState("");
  useEffect(() => {
    setDateLabel(headerDateLabel());
  }, []);

  return (
    <div className="flex items-baseline justify-between border-b border-divider px-8 py-[18px]">
      <div className="text-[26px] font-bold">TaskFlowy</div>
      <div className="flex items-baseline gap-[22px]">
        <div className="flex gap-4 text-xs text-n600">
          <span className="inline-flex items-center gap-[6px]">
            <span className="inline-block h-[10px] w-[10px] border-[1.5px] border-accent bg-white" />
            進行中
          </span>
          <span className="inline-flex items-center gap-[6px]">
            <span className="inline-block h-[10px] w-[10px] border border-n400 bg-white" />
            着手できる
          </span>
          <span className="inline-flex items-center gap-[6px]">
            <span className="inline-block h-[10px] w-[10px] border border-n300 bg-surface" />
            完了
          </span>
        </div>
        <div className="text-[13px] text-n600">{dateLabel}</div>
      </div>
    </div>
  );
}
