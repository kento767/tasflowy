"use client";

import { useEffect, useState } from "react";
import { setToastListener } from "@/lib/toast";

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    setToastListener((m) => {
      setMsg(m);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 3000);
    });
    return () => {
      setToastListener(null);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-[200] flex justify-center px-4">
      <div className="rounded-full bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg">
        {msg}
      </div>
    </div>
  );
}
