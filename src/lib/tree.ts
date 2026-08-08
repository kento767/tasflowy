import type { NodeRow, TreeNode } from "./types";

// デザインリファレンス(TaskFlowy.dc.html)のレイアウト定数
export const COL = 306; // 列間隔
export const NODE_W = 250;
export const NODE_H = 70;
export const ROW = 92; // 葉ごとの行送り

// カード下のメモ表示
export const NOTE_FONT = 11.5;
export const NOTE_LINE_H = 16;
export const NOTE_GAP = 4; // カード下端→メモ上端の隙間
export const NOTE_W = NODE_W - 24;
export const NOTE_MAX_LINES = 10; // 折りたたみ時に見せる行数
export const NOTE_TOGGLE_H = 20; // 「すべて表示/折りたたむ」ボタン行の高さ
// 縦線2px + 左pad10px を引いたテキスト幅を全角文字数に換算した1行の文字数
const NOTE_CPL = Math.floor((NOTE_W - 12) / NOTE_FONT);

/** メモの表示行数(折り返し込み)の見積もり */
export function noteLineCount(note: string): number {
  let lines = 0;
  for (const seg of note.split("\n")) {
    // 半角0.6/全角1の換算。半角を少なめに数えるとNOTE_CPLのfloorと合わせて
    // 行数は過大側に倒れ、描画(break-all)がはみ出すことはない
    let units = 0;
    for (const ch of seg) units += ch.charCodeAt(0) < 0x2000 ? 0.6 : 1;
    lines += Math.max(1, Math.ceil(units / NOTE_CPL));
  }
  return lines;
}

/**
 * メモブロックの高さ(px)。カードとの隙間NOTE_GAPを含む。メモなしは0。
 * NOTE_MAX_LINES超は折りたたみ(または展開)+トグルボタン行の高さになる
 */
export function noteBlockHeight(note: string | null, expanded = false): number {
  if (!note) return 0;
  const lines = noteLineCount(note);
  if (lines <= NOTE_MAX_LINES) return NOTE_GAP + lines * NOTE_LINE_H;
  const shown = expanded ? lines : NOTE_MAX_LINES;
  return NOTE_GAP + shown * NOTE_LINE_H + NOTE_TOGGLE_H;
}

/** フラットな行からツリーの森を組み立てる(親なし=根タスク) */
export function buildForest(rows: NodeRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  for (const n of map.values()) {
    const parent = n.parent_id ? map.get(n.parent_id) : undefined;
    if (parent) parent.children.push(n);
    else roots.push(n);
  }
  const bySort = (a: TreeNode, b: TreeNode) =>
    a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
  map.forEach((n) => n.children.sort(bySort));
  roots.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return roots;
}

export interface PlacedNode {
  node: TreeNode;
  depth: number;
  x: number;
  y: number;
  /** 祖先のパス。根は「ルート」 */
  path: string;
  /** カード下のメモブロック高さ(隙間込み)。メモなしは0 */
  noteH: number;
}

export interface TreeLayout {
  placed: PlacedNode[];
  /** 親→子コネクタのSVGパス */
  connectors: string[];
  width: number;
  height: number;
}

/**
 * ツリーレイアウト(デザインリファレンスのアルゴリズムを移植)。
 * 葉(または折りたたみ中)は行カーソル位置に置き、親は最初と最後の子の中間に置く。
 */
export function layoutTree(
  root: TreeNode,
  collapsed: Record<string, boolean>,
  expandedNotes: Record<string, boolean> = {}
): TreeLayout {
  const placed: PlacedNode[] = [];
  const connectors: string[] = [];
  let cursor = 10;
  let maxDepth = 0;

  const walk = (node: TreeNode, depth: number, parentPath: string): PlacedNode => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = node.children;
    const open = !collapsed[node.id];
    const noteH = noteBlockHeight(node.note, !!expandedNotes[node.id]);
    const rec: PlacedNode = {
      node,
      depth,
      x: 20 + depth * COL,
      y: 0,
      path: parentPath,
      noteH,
    };
    if (!kids.length || !open) {
      rec.y = cursor;
      cursor += ROW + noteH;
    } else {
      const childPath =
        parentPath === "ルート" ? node.title : `${parentPath} / ${node.title}`;
      const recs = kids.map((k) => walk(k, depth + 1, childPath));
      rec.y = (recs[0].y + recs[recs.length - 1].y) / 2;
      // 親のyは子の中点で決まるため、長いメモが後続ノードに食い込まないよう
      // カーソルをメモ下端+通常の行間まで押し下げる
      cursor = Math.max(cursor, rec.y + NODE_H + noteH + (ROW - NODE_H));
      const sx = rec.x + NODE_W;
      const sy = rec.y + NODE_H / 2;
      for (const c of recs) {
        const ex = 20 + (depth + 1) * COL;
        const ey = c.y + NODE_H / 2;
        connectors.push(
          `M${sx},${sy} C${sx + 36},${sy} ${ex - 36},${ey} ${ex},${ey}`
        );
      }
    }
    placed.push(rec);
    return rec;
  };

  walk(root, 0, "ルート");
  const height = cursor - ROW + NODE_H + 10;
  const width = Math.max(1150, 20 + maxDepth * COL + NODE_W + 20);
  return { placed, connectors, width, height };
}

/** 指定ノードの祖先パンくず(自身は含まない)。ルート直下は「ルート」。NodeCard.pathと同じ形式 */
export function nodePath(rows: NodeRow[], nodeId: string): string {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const node = byId.get(nodeId);
  if (!node) return "ルート";
  const ancestors: string[] = [];
  let cur = node.parent_id ? byId.get(node.parent_id) : undefined;
  while (cur) {
    ancestors.unshift(cur.title);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return ancestors.length ? ancestors.join(" / ") : "ルート";
}

/** 指定ノードの子孫(自身を含む)のid集合 */
export function subtreeIds(rows: NodeRow[], rootId: string): Set<string> {
  const byParent = new Map<string | null, NodeRow[]>();
  rows.forEach((r) => {
    const list = byParent.get(r.parent_id) ?? [];
    list.push(r);
    byParent.set(r.parent_id, list);
  });
  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    ids.add(id);
    (byParent.get(id) ?? []).forEach((c) => stack.push(c.id));
  }
  return ids;
}
