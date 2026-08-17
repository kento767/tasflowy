"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DoLists } from "@/components/DoLists";
import { Header } from "@/components/Header";
import { NoteDialog, type NoteDialogState } from "@/components/NoteDialog";
import { RootSidebar } from "@/components/RootSidebar";
import { TaskDialog, type DialogState, type SavePatch } from "@/components/TaskDialog";
import { TreeSection } from "@/components/TreeSection";
import type { DataSource } from "@/lib/data";
import { todayIso } from "@/lib/date";
import { toast } from "@/lib/toast";
import { buildForest, nodePath, subtreeIds } from "@/lib/tree";
import type {
  DragPayload,
  ListItem,
  ListName,
  NodeRow,
  TreeNode,
  ViewListItem,
} from "@/lib/types";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;

const FULL_ENTER_ICON =
  "M8 3H5a2 2 0 0 0-2 2v3 M21 8V5a2 2 0 0 0-2-2h-3 M3 16v3a2 2 0 0 0 2 2h3 M16 21h3a2 2 0 0 0 2-2v-3";
const FULL_EXIT_ICON =
  "M8 3v3a2 2 0 0 1-2 2H3 M21 8h-3a2 2 0 0 1-2-2V3 M3 16h3a2 2 0 0 1 2 2v3 M16 21v-3a2 2 0 0 1 2-2h3";

export function TaskFlowyApp({ db }: { db: DataSource }) {
  const [rows, setRows] = useState<NodeRow[] | null>(null);
  const [items, setItems] = useState<ListItem[] | null>(null);
  // 「今日」はSSRとのズレを避けるためマウント後に確定し、フォーカス復帰時に再計算(日跨ぎ追随)
  const [today, setToday] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // 長文メモの「すべて表示」展開状態(セッション内のみ。リロード後は折りたたみに戻す)
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);
  // 半画面など横幅が狭いときに左右の欄をたためるようにする(状態は端末に保存)
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;
  const [noteDialog, setNoteDialog] = useState<NoteDialogState | null>(null);
  const noteDialogRef = useRef(noteDialog);
  noteDialogRef.current = noteDialog;
  const dragRef = useRef<DragPayload | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const zoomWrapRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  // ズーム適用後にアンカー点(カーソル/中心)が同じ画面位置に来るようスクロールを補正する
  const zoomAnchorRef = useRef<{ x: number; y: number; prevZoom: number } | null>(
    null
  );
  const panRef = useRef<{
    id: number;
    sx: number;
    sy: number;
    sl: number;
    st: number;
  } | null>(null);

  // 初期ロード(データ + 端末ローカルのUI状態)
  useEffect(() => {
    Promise.all([db.fetchNodes(), db.fetchListItems()])
      .then(([n, i]) => {
        setRows(n);
        setItems(i);
      })
      .catch(() => toast("読み込みに失敗しました"));
    try {
      const c = localStorage.getItem("tf-collapsed");
      if (c) setCollapsed(JSON.parse(c));
      const z = Number(localStorage.getItem("tf-zoom"));
      if (z >= ZOOM_MIN && z <= ZOOM_MAX) setZoom(z);
      const lo = localStorage.getItem("tf-left-open");
      if (lo !== null) setLeftOpen(lo === "1");
      const ro = localStorage.getItem("tf-right-open");
      if (ro !== null) setRightOpen(ro === "1");
    } catch {
      // localStorage不可の環境では既定値のまま
    }
  }, [db]);

  useEffect(() => {
    try {
      localStorage.setItem("tf-collapsed", JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);
  useEffect(() => {
    try {
      localStorage.setItem("tf-zoom", String(zoom));
    } catch {}
  }, [zoom]);
  useEffect(() => {
    try {
      localStorage.setItem("tf-left-open", leftOpen ? "1" : "0");
    } catch {}
  }, [leftOpen]);
  useEffect(() => {
    try {
      localStorage.setItem("tf-right-open", rightOpen ? "1" : "0");
    } catch {}
  }, [rightOpen]);

  // 日跨ぎ: フォーカス復帰・タブ表示のたびに「今日」を取り直す
  useEffect(() => {
    const upd = () => setToday(todayIso());
    upd();
    window.addEventListener("focus", upd);
    document.addEventListener("visibilitychange", upd);
    return () => {
      window.removeEventListener("focus", upd);
      document.removeEventListener("visibilitychange", upd);
    };
  }, []);

  // Esc: ダイアログ → 全画面 の順に閉じる
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (noteDialogRef.current) setNoteDialog(null);
      else if (dialogRef.current) setDialog(null);
      else setFull(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /** ズーム変更。anchor(キャンバス左上基準の画面座標)の下のコンテンツが動かないよう補正付き */
  const applyZoom = useCallback(
    (compute: (z: number) => number, anchor?: { x: number; y: number }) => {
      const prev = zoomRef.current;
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, compute(prev)));
      if (nz === prev) return;
      if (anchor && canvasRef.current) {
        zoomAnchorRef.current = { ...anchor, prevZoom: prev };
      }
      setZoom(nz);
    },
    []
  );

  // 新しいzoomがDOMに反映された直後(描画前)にスクロール位置を補正する
  useLayoutEffect(() => {
    const a = zoomAnchorRef.current;
    const c = canvasRef.current;
    if (!a || !c) return;
    zoomAnchorRef.current = null;
    const k = zoom / a.prevZoom;
    const w = zoomWrapRef.current;
    const offX = w ? w.offsetLeft : 0;
    const offY = w ? w.offsetTop : 0;
    c.scrollLeft = (c.scrollLeft + a.x - offX) * k + offX - a.x;
    c.scrollTop = (c.scrollTop + a.y - offY) * k + offY - a.y;
  }, [zoom]);

  // トラックパッドのピンチはctrl+wheelで届く。preventDefaultするためpassive:false必須
  const attachCanvas = useCallback(
    (el: HTMLDivElement | null) => {
      canvasRef.current = el;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        applyZoom((z) => z * Math.exp(-e.deltaY * 0.012), {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => {
        el.removeEventListener("wheel", onWheel);
        canvasRef.current = null;
      };
    },
    [applyZoom]
  );

  // 画面を掴んでドラッグでパン。左ボタンは背景のみ、中ボタンはどこからでも
  const startPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return; // タッチはネイティブスクロールに任せる
    const c = canvasRef.current;
    if (!c) return;
    // スクロールバー上のクリックはパンにしない
    const rect = c.getBoundingClientRect();
    if (
      e.clientX - rect.left >= c.clientWidth ||
      e.clientY - rect.top >= c.clientHeight
    ) {
      return;
    }
    if (e.button === 0) {
      const t = e.target as HTMLElement;
      if (t.closest('[data-node], [class*="cursor-pointer"], input, button')) {
        return;
      }
    } else if (e.button !== 1) {
      return;
    }
    panRef.current = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      sl: c.scrollLeft,
      st: c.scrollTop,
    };
    try {
      c.setPointerCapture(e.pointerId);
    } catch {}
    e.preventDefault();
    document.documentElement.classList.add("tf-panning");
  };
  const movePan = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = panRef.current;
    const c = canvasRef.current;
    if (!p || !c || e.pointerId !== p.id) return;
    c.scrollLeft = p.sl - (e.clientX - p.sx);
    c.scrollTop = p.st - (e.clientY - p.sy);
  };
  const endPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = panRef.current;
    if (!p || e.pointerId !== p.id) return;
    panRef.current = null;
    document.documentElement.classList.remove("tf-panning");
  };

  const forest = useMemo(() => (rows ? buildForest(rows) : []), [rows]);

  const doneNodeIds = useMemo(
    () =>
      new Set((rows ?? []).filter((r) => r.status === "done").map((r) => r.id)),
    [rows]
  );

  // リンク先ノードの完了をチェック状態に織り込む
  const viewItems = useMemo(
    () =>
      (items ?? []).map((x) => ({
        ...x,
        effChecked:
          x.checked || (!!x.node_id && doneNodeIds.has(x.node_id)),
      })),
    [items, doneNodeIds]
  );

  // 遅延クリーンアップ: 昨日以前に「今日やる」へ載せて完了済みのものは、日が変わったら片付ける
  // (完了の記録はツリー側のノードに残る)。ロード直後と日跨ぎ時に1回だけ走らせる
  const cleanupDoneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!items || !rows || !today) return;
    if (cleanupDoneRef.current === today) return;
    cleanupDoneRef.current = today;
    const stale = items.filter(
      (x) =>
        x.list === "today" &&
        x.listed_on < today &&
        (x.checked || (!!x.node_id && doneNodeIds.has(x.node_id)))
    );
    if (!stale.length) return;
    const staleIds = new Set(stale.map((x) => x.id));
    setItems((s) => s?.filter((x) => !staleIds.has(x.id)) ?? s);
    stale.forEach((x) => {
      if (!x.id.startsWith("temp-")) db.deleteListItem(x.id).catch(() => {});
    });
  }, [items, rows, today, doneNodeIds, db]);

  // 期限つきノードを「今日やる/明日以降やる」に自動反映する。
  // 期限切れ・今日期限 → 今日やる / それより先の期限 → 明日以降やる。
  // ノードの期限が変われば自動で移動し、期限が外れる/削除されると自動追加分は片付ける。
  // 手動でドラッグしたカード(auto=false)や×で外したノード(dismissed_on=当日)には触れない
  useEffect(() => {
    if (!rows || !items || !today) return;
    const byNodeId = new Map(items.map((x) => [x.node_id, x]));

    for (const node of rows) {
      if (node.status === "done" || !node.due_date) continue;
      if (node.dismissed_on === today) continue;
      const targetList: ListName = node.due_date <= today ? "today" : "later";
      const existing = byNodeId.get(node.id);

      if (!existing) {
        const temp: ListItem = {
          id: `temp-${crypto.randomUUID()}`,
          user_id: "",
          list: targetList,
          title: node.title,
          path: nodePath(rows, node.id),
          due_date: node.due_date,
          node_id: node.id,
          checked: false,
          listed_on: today,
          auto: true,
          created_at: new Date().toISOString(),
        };
        setItems((s) =>
          s?.some((x) => x.node_id === node.id) ? s : [...(s ?? []), temp]
        );
        db.createListItem({
          list: targetList,
          title: node.title,
          path: nodePath(rows, node.id),
          due_date: node.due_date,
          node_id: node.id,
          listed_on: today,
          auto: true,
        })
          .then((row) =>
            setItems((s) => s?.map((x) => (x.id === temp.id ? row : x)) ?? s)
          )
          .catch(() => setItems((s) => s?.filter((x) => x.id !== temp.id) ?? s));
        continue;
      }

      if (existing.auto) {
        const path = nodePath(rows, node.id);
        const listChanged = existing.list !== targetList;
        const needsUpdate =
          listChanged ||
          existing.due_date !== node.due_date ||
          existing.title !== node.title ||
          existing.path !== path;
        if (needsUpdate) {
          const patch: Partial<
            Pick<ListItem, "list" | "listed_on" | "due_date" | "title" | "path">
          > = {
            due_date: node.due_date,
            title: node.title,
            path,
          };
          if (listChanged) {
            patch.list = targetList;
            if (targetList === "today" && existing.list !== "today") {
              patch.listed_on = today;
            }
          }
          setItems(
            (s) => s?.map((x) => (x.id === existing.id ? { ...x, ...patch } : x)) ?? s
          );
          if (!existing.id.startsWith("temp-")) {
            db.updateListItem(existing.id, patch).catch(() => {});
          }
        }
      }
    }

    // 期限が外れた/ノードが消えた/その日は隠された 自動追加分を片付ける
    const rowsById = new Map(rows.map((r) => [r.id, r]));
    const toDrop = items.filter((x) => {
      if (!x.auto || !x.node_id) return false;
      const node = rowsById.get(x.node_id);
      if (!node) return true;
      if (!node.due_date) return true;
      if (node.dismissed_on === today) return true;
      return false;
    });
    if (toDrop.length) {
      const dropIds = new Set(toDrop.map((x) => x.id));
      setItems((s) => s?.filter((x) => !dropIds.has(x.id)) ?? s);
      toDrop.forEach((x) => {
        if (!x.id.startsWith("temp-")) db.deleteListItem(x.id).catch(() => {});
      });
    }
  }, [rows, items, today, db]);

  const refresh = () => {
    db.fetchNodes().then(setRows).catch(() => {});
    db.fetchListItems().then(setItems).catch(() => {});
  };
  const fail = (msg: string) => {
    toast(msg);
    refresh();
  };

  /** キャンバス中心を基準にズーム(ボタン/リセット用) */
  const centerAnchor = () => {
    const c = canvasRef.current;
    return c ? { x: c.clientWidth / 2, y: c.clientHeight / 2 } : undefined;
  };
  const stepZoom = (dz: number) =>
    applyZoom(
      (z) => Math.round((z + dz) * 10) / 10,
      centerAnchor()
    );

  const goToTree = (id: string) => {
    const el = document.getElementById(`tree-${id}`);
    const c = canvasRef.current;
    if (el && c) {
      c.scrollTo({
        top:
          el.getBoundingClientRect().top -
          c.getBoundingClientRect().top +
          c.scrollTop -
          12,
        behavior: "smooth",
      });
    }
  };

  const openAddChild = (node: TreeNode) =>
    setDialog({ mode: "add", parentId: node.id, parentTitle: node.title });
  const openAddRoot = () =>
    setDialog({ mode: "add", parentId: null, parentTitle: null });
  const openEdit = (node: TreeNode) => {
    const { children: _children, ...row } = node;
    setDialog({ mode: "edit", node: row });
  };
  const openNote = (node: TreeNode) =>
    setNoteDialog({ nodeId: node.id, title: node.title, note: node.note });

  const handleSaveNote = (id: string, note: string | null) => {
    setNoteDialog(null);
    setRows((s) => s?.map((r) => (r.id === id ? { ...r, note } : r)) ?? s);
    db.updateNode(id, { note }).catch(() => fail("保存に失敗しました"));
  };

  const handleCreate = ({
    parentId,
    title,
    due,
    note,
  }: {
    parentId: string | null;
    title: string;
    due: string | null;
    note: string | null;
  }) => {
    setDialog(null);
    const siblings = (rows ?? []).filter((r) => r.parent_id === parentId);
    const sort = siblings.length
      ? Math.max(...siblings.map((s) => s.sort_order)) + 1
      : 0;
    // 親が折りたたみ中なら展開する
    if (parentId) setCollapsed((c) => ({ ...c, [parentId]: false }));
    db.createNode({ parent_id: parentId, title, due_date: due, note, sort_order: sort })
      .then((row) => setRows((s) => [...(s ?? []), row]))
      .catch(() => fail("追加に失敗しました"));
  };

  const handleSave = (id: string, patch: SavePatch) => {
    setDialog(null);
    const prev = rows?.find((r) => r.id === id);
    const applied = {
      ...patch,
      next_flag: patch.status === "done" ? false : patch.next_flag,
      done_date:
        patch.status === "done" ? (prev?.done_date ?? todayIso()) : null,
    };
    setRows((s) => s?.map((r) => (r.id === id ? { ...r, ...applied } : r)) ?? s);
    db.updateNode(id, applied).catch(() => fail("保存に失敗しました"));
  };

  const handleDelete = (id: string) => {
    setDialog(null);
    if (!rows) return;
    const ids = subtreeIds(rows, id);
    setRows((s) => s?.filter((r) => !ids.has(r.id)) ?? s);
    db.deleteNode(id).catch(() => fail("削除に失敗しました"));
  };

  /** リストカードのゾーン間移動(今日へ移すときは listed_on を今日に更新) */
  const moveItem = (item: ListItem, list: ListName, t: string) => {
    const patch =
      list === "today" ? { list, listed_on: t } : { list };
    setItems((s) => s?.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) ?? s);
    if (!item.id.startsWith("temp-")) {
      db.updateListItem(item.id, patch).catch(() => fail("移動に失敗しました"));
    }
  };

  const handleDrop = (list: ListName, e: DragEvent) => {
    e.preventDefault();
    const p = dragRef.current;
    dragRef.current = null;
    if (!p || !items) return;
    const t = today ?? todayIso();

    if (p.kind === "item") {
      const it = p.item;
      // 移動先に同一タスク(タイトル+パス)が既にあれば統合(元カードを削除)
      const dup = items.find(
        (x) =>
          x.id !== it.id &&
          x.list === list &&
          x.title === it.title &&
          x.path === it.path
      );
      if (dup) {
        handleRemoveItem(it);
        return;
      }
      // 変化がなければ何もしない(持ち越し→今日やる は listed_on の更新が必要)
      if (it.list === list && (list !== "today" || it.listed_on === t)) return;
      moveItem(it, list, t);
      return;
    }

    // ツリーからのコピー。同一タスクの重複追加は無視するが、
    // 持ち越し中の同一タスクを今日やるへ落とした場合は「今日再挑戦」として再コミットする
    const dup = items.find(
      (x) => x.list === list && x.title === p.title && x.path === p.path
    );
    if (dup) {
      if (list === "today" && dup.listed_on < t && !dup.checked) {
        moveItem(dup, "today", t);
      }
      return;
    }
    const temp: ListItem = {
      id: `temp-${crypto.randomUUID()}`,
      user_id: "",
      list,
      title: p.title,
      path: p.path,
      due_date: p.due_date,
      node_id: p.node_id,
      checked: false,
      listed_on: t,
      auto: false,
      created_at: new Date().toISOString(),
    };
    setItems((s) => [...(s ?? []), temp]);
    db.createListItem({
      list,
      title: p.title,
      path: p.path,
      due_date: p.due_date,
      node_id: p.node_id,
      listed_on: t,
    })
      .then((row) =>
        setItems((s) => s?.map((x) => (x.id === temp.id ? row : x)) ?? s)
      )
      .catch(() => fail("追加に失敗しました"));
  };

  /** チェック丸: リストのチェックとリンク先ノードの完了を同期させる */
  const handleToggleItem = (item: ViewListItem) => {
    const next = !item.effChecked;
    setItems(
      (s) =>
        s?.map((x) => (x.id === item.id ? { ...x, checked: next } : x)) ?? s
    );
    if (!item.id.startsWith("temp-")) {
      db.updateListItem(item.id, { checked: next }).catch(() =>
        fail("更新に失敗しました")
      );
    }
    if (item.node_id && rows?.some((r) => r.id === item.node_id)) {
      const patch = next
        ? {
            status: "done" as const,
            done_date: today ?? todayIso(),
            next_flag: false,
          }
        : { status: "todo" as const, done_date: null };
      setRows(
        (s) =>
          s?.map((r) => (r.id === item.node_id ? { ...r, ...patch } : r)) ?? s
      );
      db.updateNode(item.node_id, patch).catch(() => fail("更新に失敗しました"));
    }
  };

  const handleRemoveItem = (item: ListItem) => {
    setItems((s) => s?.filter((x) => x.id !== item.id) ?? s);
    // 自動追加されたカードを外した場合は、今日だけ再表示しないようノードに記録する
    if (item.auto && item.node_id) {
      const t = today ?? todayIso();
      setRows(
        (s) => s?.map((r) => (r.id === item.node_id ? { ...r, dismissed_on: t } : r)) ?? s
      );
      db.updateNode(item.node_id, { dismissed_on: t }).catch(() => {});
    }
    if (!item.id.startsWith("temp-")) {
      db.deleteListItem(item.id).catch(() => fail("削除に失敗しました"));
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <div className="flex min-h-0 flex-1 items-stretch">
        {leftOpen ? (
          <RootSidebar
            roots={forest}
            onGo={goToTree}
            onAddRoot={openAddRoot}
            onClose={() => setLeftOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setLeftOpen(true)}
            title="根タスク一覧を開く"
            className="flex w-6 flex-none cursor-pointer items-center justify-center border-r border-divider bg-n100 text-n600 select-none hover:bg-accent-100"
          >
            <span
              style={{ writingMode: "vertical-rl" }}
              className="py-2 text-[11px] tracking-[2px]"
            >
              根タスク
            </span>
          </button>
        )}

        <div
          ref={attachCanvas}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          className={
            full
              ? "fixed inset-0 z-50 cursor-grab overflow-auto bg-n100 p-[20px_32px_28px]"
              : "relative flex-1 cursor-grab overflow-auto bg-n100 p-[20px_32px_28px]"
          }
        >
          <div className="sticky top-0 left-0 z-10 mb-2 flex justify-end gap-[10px]">
            <div
              onClick={() => setFull((f) => !f)}
              className="inline-flex cursor-pointer items-center gap-[7px] rounded-xl border border-n400 bg-white px-3 py-1 text-xs text-n700 select-none hover:bg-accent-100"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={full ? FULL_EXIT_ICON : FULL_ENTER_ICON} />
              </svg>
              {full ? "全画面を終了" : "全画面"}
            </div>
            <div className="inline-flex items-center rounded-xl border border-n400 bg-white">
              <span
                onClick={() => stepZoom(-0.1)}
                className="cursor-pointer border-r border-divider px-3 py-1 text-[15px] leading-none select-none hover:bg-accent-100"
              >
                −
              </span>
              <span
                onClick={() => applyZoom(() => 1, centerAnchor())}
                className="min-w-[38px] cursor-pointer px-[10px] py-1 text-center text-xs text-n600 tabular-nums select-none hover:bg-accent-100"
              >
                {Math.round(zoom * 100)}%
              </span>
              <span
                onClick={() => stepZoom(0.1)}
                className="cursor-pointer border-l border-divider px-3 py-1 text-[15px] leading-none select-none hover:bg-accent-100"
              >
                +
              </span>
            </div>
          </div>

          {/* 右の余白: 最右端のタスクを画面中央あたりまでスクロールできるようにする。
              box-content + w-max でコンテンツ幅に余白を上乗せし、
              ズームの影響を受けないようzoomラッパーの外に付ける */}
          <div
            className="box-content w-max min-w-full"
            style={forest.length > 0 ? { paddingRight: "45vw" } : undefined}
          >
            <div ref={zoomWrapRef} style={{ zoom }}>
              {rows === null ? (
                <div className="py-16 text-center text-[13px] text-n500">
                  読み込み中…
                </div>
              ) : forest.length === 0 ? (
                <div className="py-16 text-center text-[13px] text-n500">
                  まだタスクがありません。左の「＋ 根タスクを追加」から始めましょう。
                </div>
              ) : (
                forest.map((tree) => (
                  <TreeSection
                    key={tree.id}
                    tree={tree}
                    collapsed={collapsed}
                    expandedNotes={expandedNotes}
                    onToggle={(id) =>
                      setCollapsed((c) => ({ ...c, [id]: !c[id] }))
                    }
                    onToggleNote={(id) =>
                      setExpandedNotes((s) => ({ ...s, [id]: !s[id] }))
                    }
                    onAddChild={openAddChild}
                    onEdit={openEdit}
                    onOpenNote={openNote}
                    onDragStart={(p) => {
                      dragRef.current = p;
                    }}
                  />
                ))
              )}
            </div>
          </div>
          {/* 下部の余白: 最下部のタスクを画面中央あたりまでスクロールできるようにする。
              ズームの影響を受けないようzoomラッパーの外に置く */}
          {forest.length > 0 && <div aria-hidden className="h-[45vh]" />}
        </div>

        {rightOpen ? (
          <DoLists
            items={viewItems}
            today={today}
            onDrop={handleDrop}
            onRemove={handleRemoveItem}
            onToggle={handleToggleItem}
            onItemDragStart={(item) => {
              dragRef.current = { kind: "item", item };
            }}
            onClose={() => setRightOpen(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setRightOpen(true)}
            title="今日やる/明日以降やるを開く"
            className="flex w-6 flex-none cursor-pointer items-center justify-center border-l border-divider bg-n100 text-n600 select-none hover:bg-accent-100"
          >
            <span
              style={{ writingMode: "vertical-rl" }}
              className="py-2 text-[11px] tracking-[2px]"
            >
              今日やる
            </span>
          </button>
        )}
      </div>

      {dialog && (
        <TaskDialog
          key={
            dialog.mode === "edit"
              ? `e-${dialog.node.id}`
              : `a-${dialog.parentId ?? "root"}`
          }
          state={dialog}
          onClose={() => setDialog(null)}
          onCreate={handleCreate}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
      {noteDialog && (
        <NoteDialog
          key={`n-${noteDialog.nodeId}`}
          state={noteDialog}
          onClose={() => setNoteDialog(null)}
          onSave={handleSaveNote}
        />
      )}
    </div>
  );
}
