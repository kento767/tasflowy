"use client";

import { useState, type FormEvent } from "react";

/** マップ上のメモをクリックしたときの拡大表示・編集用ダイアログ */
export interface NoteDialogState {
  nodeId: string;
  title: string;
  note: string | null;
}

interface NoteDialogProps {
  state: NoteDialogState;
  onClose: () => void;
  onSave: (id: string, note: string | null) => void;
}

export function NoteDialog({ state, onClose, onSave }: NoteDialogProps) {
  const [note, setNote] = useState(state.note ?? "");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(state.nodeId, note.trim() ? note.trim() : null);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(32,31,29,0.32)]"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-[720px] max-w-[94vw] rounded-xl border border-n400 bg-white p-[26px_28px] shadow-dialog"
      >
        <div className="text-[20px] font-bold">メモ</div>
        <div className="mt-1 border-b border-divider pb-[14px] text-xs text-n600">
          {`「${state.title}」のメモを表示・編集します`}
        </div>
        <textarea
          className="input mt-4 resize-y"
          style={{ fontSize: 15, lineHeight: 1.7, height: "56vh", minHeight: 320 }}
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="補足や参考リンクなど"
        />
        <div className="mt-[18px] flex justify-end gap-[10px]">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary">
            保存
          </button>
        </div>
      </form>
    </div>
  );
}
