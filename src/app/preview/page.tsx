"use client";

// 開発環境専用のUIプレビュー。デザインリファレンス(seedTrees相当)のサンプルデータを
// メモリ上で操作する。本番では middleware が /login へリダイレクトする。

import { useMemo } from "react";
import { TaskFlowyApp } from "@/components/TaskFlowyApp";
import type { DataSource } from "@/lib/data";
import { todayStart, toIso } from "@/lib/date";
import type { ListItem, NodeRow, NodeStatus } from "@/lib/types";

const Y = new Date().getFullYear();
const iso = (md: string) => {
  const [m, d] = md.split("/").map(Number);
  return `${Y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

let seq = 0;
function node(
  id: string,
  parent_id: string | null,
  title: string,
  opts: Partial<
    Pick<NodeRow, "due_date" | "note" | "status" | "next_flag" | "done_date">
  > = {}
): NodeRow {
  seq += 1;
  return {
    id,
    user_id: "preview",
    parent_id,
    title,
    due_date: opts.due_date ?? null,
    note: opts.note ?? null,
    status: (opts.status ?? "todo") as NodeStatus,
    next_flag: opts.next_flag ?? false,
    done_date: opts.done_date ?? null,
    sort_order: seq,
    created_at: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
    dismissed_on: null,
  };
}

function seedNodes(): NodeRow[] {
  seq = 0;
  return [
    node("hikkoshi", null, "引っ越し準備", { due_date: iso("8/31"), status: "active" }),
    node("bukken", "hikkoshi", "物件を決める", { status: "done", done_date: iso("7/28") }),
    node("naiken", "bukken", "内見", { status: "done", done_date: iso("7/20") }),
    node("keiyaku", "bukken", "契約", { status: "done", done_date: iso("7/28") }),
    node("nizukuri", "hikkoshi", "荷造り", { due_date: iso("8/20"), status: "active" }),
    node("dambo", "nizukuri", "段ボール調達", { status: "done", done_date: iso("8/1") }),
    node("hon", "nizukuri", "本の梱包", {
      due_date: iso("8/10"),
      status: "active",
      note: "売る本と持っていく本を先に分ける。\n漫画は買取アプリで査定に出す。",
    }),
    node("shokki", "nizukuri", "食器の梱包", {
      due_date: iso("8/14"),
      next_flag: true,
      note: "グラス類は1つずつ緩衝材で包む。割れ物シールを箱の側面に貼ること。皿は立てて詰めると割れにくいらしいので試す。",
    }),
    node("kansho", "shokki", "緩衝材を買う", { due_date: iso("8/13") }),
    node("tetsuzuki", "hikkoshi", "手続き", { due_date: iso("8/12") }),
    node("denki", "tetsuzuki", "電気・ガス解約", { due_date: iso("8/7"), next_flag: true }),
    node("tenshutsu", "tetsuzuki", "転出届", { due_date: iso("8/12") }),
    node("site", null, "ポートフォリオ制作", { due_date: iso("9/30"), status: "active" }),
    node("jisso", "site", "実装", { due_date: iso("9/20"), status: "active" }),
    node("top", "jisso", "トップページ", { due_date: iso("9/5"), status: "active" }),
    node("form", "jisso", "問い合わせフォーム", { due_date: iso("9/12"), next_flag: true }),
    node("design", "site", "デザイン案", { status: "done", done_date: iso("7/25") }),
    node("haisha", null, "歯医者の予約", {
      due_date: iso("8/8"),
      next_flag: true,
      note: "予約は https://example.com/dental から",
    }),
  ];
}

function seedItems(): ListItem[] {
  const today = toIso(todayStart());
  const y = todayStart();
  y.setDate(y.getDate() - 1);
  const yesterday = toIso(y);
  return [
    {
      id: "i1",
      user_id: "preview",
      list: "today",
      title: "本の梱包",
      path: "引っ越し準備 / 荷造り",
      due_date: iso("8/10"),
      node_id: "hon",
      checked: false,
      listed_on: today,
      auto: false,
      created_at: new Date(2026, 0, 1).toISOString(),
    },
    {
      id: "i2",
      user_id: "preview",
      list: "later",
      title: "転出届",
      path: "引っ越し準備 / 手続き",
      due_date: iso("8/12"),
      node_id: "tenshutsu",
      checked: false,
      listed_on: today,
      auto: false,
      created_at: new Date(2026, 0, 1).toISOString(),
    },
    // 昨日「今日やる」に載せたが未完了 → 持ち越しセクションに出る
    {
      id: "i3",
      user_id: "preview",
      list: "today",
      title: "緩衝材を買う",
      path: "引っ越し準備 / 荷造り / 食器の梱包",
      due_date: iso("8/13"),
      node_id: "kansho",
      checked: false,
      listed_on: yesterday,
      auto: false,
      created_at: new Date(2026, 0, 1).toISOString(),
    },
  ];
}

function memoryDb(): DataSource {
  let nodes = seedNodes();
  let items = seedItems();
  let n = 0;
  const uid = () => `mem-${++n}`;
  return {
    async fetchNodes() {
      return [...nodes];
    },
    async createNode(input) {
      const row: NodeRow = {
        id: uid(),
        user_id: "preview",
        status: "todo",
        next_flag: false,
        done_date: null,
        dismissed_on: null,
        created_at: new Date().toISOString(),
        ...input,
      };
      nodes = [...nodes, row];
      return row;
    },
    async updateNode(id, patch) {
      nodes = nodes.map((x) => (x.id === id ? { ...x, ...patch } : x));
    },
    async deleteNode(id) {
      const drop = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const x of nodes) {
          if (x.parent_id && drop.has(x.parent_id) && !drop.has(x.id)) {
            drop.add(x.id);
            changed = true;
          }
        }
      }
      nodes = nodes.filter((x) => !drop.has(x.id));
    },
    async fetchListItems() {
      return [...items];
    },
    async createListItem(input) {
      const row: ListItem = {
        id: uid(),
        user_id: "preview",
        checked: false,
        auto: false,
        created_at: new Date().toISOString(),
        ...input,
      };
      items = [...items, row];
      return row;
    },
    async updateListItem(id, patch) {
      items = items.map((x) => (x.id === id ? { ...x, ...patch } : x));
    },
    async deleteListItem(id) {
      items = items.filter((x) => x.id !== id);
    },
  };
}

export default function PreviewPage() {
  const db = useMemo(() => memoryDb(), []);
  return <TaskFlowyApp db={db} />;
}
