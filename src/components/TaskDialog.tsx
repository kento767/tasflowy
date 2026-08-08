"use client";

import { useState, type FormEvent } from "react";
import { formatMD, parseDueInput } from "@/lib/date";
import { toast } from "@/lib/toast";
import type { NodeRow, NodeStatus } from "@/lib/types";

export type DialogState =
  | { mode: "add"; parentId: string | null; parentTitle: string | null }
  | { mode: "edit"; node: NodeRow };

export interface SavePatch {
  title: string;
  due_date: string | null;
  note: string | null;
  status: NodeStatus;
  next_flag: boolean;
}

interface TaskDialogProps {
  state: DialogState;
  onClose: () => void;
  onCreate: (input: {
    parentId: string | null;
    title: string;
    due: string | null;
    note: string | null;
  }) => void;
  onSave: (id: string, patch: SavePatch) => void;
  onDelete: (id: string) => void;
}

const STATUS_LABELS: { value: NodeStatus; label: string }[] = [
  { value: "todo", label: "未着手" },
  { value: "active", label: "進行中" },
  { value: "done", label: "完了" },
];

export function TaskDialog({
  state,
  onClose,
  onCreate,
  onSave,
  onDelete,
}: TaskDialogProps) {
  const isEdit = state.mode === "edit";
  const [title, setTitle] = useState(isEdit ? state.node.title : "");
  const [due, setDue] = useState(
    isEdit && state.node.due_date ? formatMD(state.node.due_date) : ""
  );
  const [status, setStatus] = useState<NodeStatus>(
    isEdit ? state.node.status : "todo"
  );
  const [note, setNote] = useState(isEdit ? (state.node.note ?? "") : "");
  const [next, setNext] = useState(isEdit ? state.node.next_flag : false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const heading = isEdit
    ? "タスクを編集"
    : state.parentTitle
      ? "子タスクを追加"
      : "根タスクを追加";
  const sub = isEdit
    ? `「${state.node.title}」の内容と状態を変更します`
    : state.parentTitle
      ? `「${state.parentTitle}」の下に追加します`
      : "新しいツリーを作成します";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    const parsed = parseDueInput(due);
    if (!parsed.ok) {
      toast("期限は「8/15」の形式で入力してください");
      return;
    }
    const noteVal = note.trim() ? note.trim() : null;
    if (state.mode === "add") {
      onCreate({ parentId: state.parentId, title: t, due: parsed.iso, note: noteVal });
    } else {
      onSave(state.node.id, {
        title: t,
        due_date: parsed.iso,
        note: noteVal,
        status,
        next_flag: next,
      });
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(32,31,29,0.32)]"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] rounded-xl border border-n400 bg-white p-[26px_28px] shadow-dialog"
      >
        <div className="text-[20px] font-bold">{heading}</div>
        <div className="mt-1 border-b border-divider pb-[14px] text-xs text-n600">
          {sub}
        </div>
        <div className="mt-4">
          <div className="mb-[6px] text-xs tracking-[2px] text-n600">タスク名</div>
          <input
            className="input"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：食器の梱包"
          />
        </div>
        <div className="mt-[14px]">
          <div className="mb-[6px] text-xs tracking-[2px] text-n600">
            期限（任意）
          </div>
          <input
            className="input"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            placeholder="例：8/15"
          />
        </div>
        <div className="mt-[14px]">
          <div className="mb-[6px] text-xs tracking-[2px] text-n600">
            メモ（任意）
          </div>
          <textarea
            className="input resize-y"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="補足や参考リンクなど"
          />
        </div>
        {isEdit && (
          <>
            <div className="mt-[14px]">
              <div className="mb-[6px] text-xs tracking-[2px] text-n600">状態</div>
              <div className="flex overflow-hidden rounded-lg border border-n400">
                {STATUS_LABELS.map((s, i) => (
                  <button
                    type="button"
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={`flex-1 cursor-pointer py-2 text-[13px] ${
                      i > 0 ? "border-l border-divider" : ""
                    } ${
                      status === s.value
                        ? "bg-accent-100 font-bold text-chip-blue"
                        : "bg-white text-n600 hover:bg-n100"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="mt-[14px] flex cursor-pointer items-center gap-2 text-[13px] text-n600">
              <input
                type="checkbox"
                checked={next}
                onChange={(e) => setNext(e.target.checked)}
                className="accent-accent"
              />
              「次にやる」チップを付ける
            </label>
          </>
        )}
        <div
          className={`mt-[22px] flex items-center ${isEdit ? "justify-between" : "justify-end"}`}
        >
          {isEdit && (
            <button
              type="button"
              onClick={() =>
                confirmDelete ? onDelete(state.node.id) : setConfirmDelete(true)
              }
              className="cursor-pointer text-[13px] text-overdue hover:underline"
            >
              {confirmDelete ? "本当に削除する（子タスクも消えます）" : "削除"}
            </button>
          )}
          <div className="flex gap-[10px]">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? "保存" : "追加"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
