"use client";

import type { DragEvent } from "react";
import { formatMD, todayIso } from "@/lib/date";
import type { ListItem, ListName, ViewListItem } from "@/lib/types";
import { DuePill } from "./pills";

/** リストカードのドラッグをdragover時に判別するためのMIMEタイプ */
const ITEM_DRAG_TYPE = "application/x-taskflowy-item";

interface DoListsProps {
  items: ViewListItem[];
  /** 端末ローカルの今日(マウント前はnull) */
  today: string | null;
  onDrop: (list: ListName, e: DragEvent) => void;
  onRemove: (item: ListItem) => void;
  onToggle: (item: ViewListItem) => void;
  onItemDragStart: (item: ListItem) => void;
  onClose: () => void;
}

export function DoLists({
  items,
  today,
  onDrop,
  onRemove,
  onToggle,
  onItemDragStart,
  onClose,
}: DoListsProps) {
  const t = today ?? todayIso();
  // 日跨ぎは表示時に導出する: 今日やるのうち昨日以前に載せた未処理分が「未完了(持ち越し)」
  const carry = items
    .filter((x) => x.list === "today" && x.listed_on < t)
    .sort((a, b) => a.listed_on.localeCompare(b.listed_on));
  const todayItems = items.filter((x) => x.list === "today" && x.listed_on >= t);
  const laterItems = items.filter((x) => x.list === "later");

  return (
    <div className="flex w-[336px] flex-none flex-col gap-7 overflow-auto border-l border-divider bg-n100 p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs tracking-[3px] text-n600">やることリスト</span>
        <button
          type="button"
          onClick={onClose}
          title="閉じる"
          className="inline-flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-full text-[15px] leading-none text-n600 hover:bg-n200 hover:text-n900"
        >
          ×
        </button>
      </div>
      {carry.length > 0 && (
        <div>
          <div className="mb-[10px] flex items-baseline justify-between">
            <span className="text-xs tracking-[3px] text-overdue">
              未完了 ─ 持ち越し
            </span>
          </div>
          {carry.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              carryFrom={item.listed_on}
              onRemove={onRemove}
              onToggle={onToggle}
              onItemDragStart={onItemDragStart}
            />
          ))}
          <div className="text-center text-xs leading-[1.7] text-n500">
            完了ボタンで片付け ・ 下の欄へドラッグで今日/明日以降へ
          </div>
        </div>
      )}
      <Zone
        list="today"
        label="今日やる"
        right={today ? formatMD(today) : ""}
        kickerClass="text-accent-700"
        items={todayItems}
        onDrop={onDrop}
        onRemove={onRemove}
        onToggle={onToggle}
        onItemDragStart={onItemDragStart}
      />
      <Zone
        list="later"
        label="明日以降やる"
        kickerClass="text-n700"
        items={laterItems}
        onDrop={onDrop}
        onRemove={onRemove}
        onToggle={onToggle}
        onItemDragStart={onItemDragStart}
      />
    </div>
  );
}

function Zone({
  list,
  label,
  right,
  kickerClass,
  items,
  onDrop,
  onRemove,
  onToggle,
  onItemDragStart,
}: {
  list: ListName;
  label: string;
  right?: string;
  kickerClass: string;
  items: ViewListItem[];
  onDrop: (list: ListName, e: DragEvent) => void;
  onRemove: (item: ListItem) => void;
  onToggle: (item: ViewListItem) => void;
  onItemDragStart: (item: ListItem) => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        // effectAllowedと矛盾するdropEffectを立てるとdropイベントが発火しない。
        // リストカード(move)とツリーからのコピー(copy)で出し分ける
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes(ITEM_DRAG_TYPE)
          ? "move"
          : "copy";
      }}
      onDrop={(e) => onDrop(list, e)}
    >
      <div className="mb-[10px] flex items-baseline justify-between">
        <span className={`text-xs tracking-[3px] ${kickerClass}`}>{label}</span>
        {right && <span className="text-xs text-n600">{right}</span>}
      </div>
      <div className="min-h-24 rounded-xl border border-dashed border-n400 px-[14px] py-[10px]">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onRemove={onRemove}
            onToggle={onToggle}
            onItemDragStart={onItemDragStart}
          />
        ))}
        <div className="py-[10px] text-center text-xs text-n500">
          ツリーからここへドラッグでコピー
        </div>
      </div>
    </div>
  );
}

function ItemCard({
  item,
  carryFrom,
  onRemove,
  onToggle,
  onItemDragStart,
}: {
  item: ViewListItem;
  /** 持ち越し元の日付(未完了セクションでのみ表示) */
  carryFrom?: string;
  onRemove: (item: ListItem) => void;
  onToggle: (item: ViewListItem) => void;
  onItemDragStart: (item: ListItem) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.title);
        e.dataTransfer.setData(ITEM_DRAG_TYPE, "1");
        e.dataTransfer.effectAllowed = "move";
        onItemDragStart(item);
      }}
      className="mb-[10px] flex cursor-grab items-center gap-[6px] rounded-2xl border border-n400 bg-white py-[10px] pr-2 pl-3 shadow-card"
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[15px] leading-[1.25] font-bold ${
            item.effChecked ? "text-n500 line-through" : "text-n900"
          }`}
        >
          {item.title}
        </span>
        <span className="mt-[5px] flex items-center gap-[6px]">
          <span className="truncate text-[11.5px] text-n600">{item.path}</span>
          {carryFrom && (
            <span className="text-[11px] whitespace-nowrap text-overdue">
              {formatMD(carryFrom)}から
            </span>
          )}
          {item.due_date && <DuePill due={item.due_date} />}
        </span>
      </span>
      <span className="flex flex-none items-center gap-[2px]">
        <button
          type="button"
          onClick={() => onToggle(item)}
          className={`cursor-pointer rounded-full border bg-white px-2 py-[3px] text-[11.5px] leading-4 whitespace-nowrap ${
            item.effChecked
              ? "border-n400 font-medium text-n600 hover:bg-n200"
              : "border-accent font-bold text-chip-blue hover:bg-accent-100"
          }`}
        >
          {item.effChecked ? "戻す" : "完了"}
        </button>
        <button
          type="button"
          onClick={() => onRemove(item)}
          title="リストから外す"
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[17px] leading-none text-n600 hover:bg-n200 hover:text-n900"
        >
          ×
        </button>
      </span>
    </div>
  );
}
