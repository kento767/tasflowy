"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("メールアドレスまたはパスワードが正しくありません");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("サインインに失敗しました。接続設定を確認してください");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col justify-center bg-n100 px-6">
      <div className="mx-auto w-full max-w-[380px] rounded-2xl border border-n400 bg-white p-8 shadow-card">
        <h1 className="text-center text-[26px] font-bold">TaskFlowy</h1>
        <p className="mt-1 text-center text-xs text-n600">
          ツリーで進捗がひと目でわかるTODO
        </p>
        <form onSubmit={submit} className="mt-7 flex flex-col gap-3">
          <input
            className="input"
            type="email"
            required
            autoComplete="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-[13px] text-soon">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary mt-2 disabled:opacity-50"
          >
            {loading ? "サインイン中..." : "サインイン"}
          </button>
        </form>
      </div>
    </main>
  );
}
