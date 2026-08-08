"use client";

import { TaskFlowyApp } from "@/components/TaskFlowyApp";
import { supabaseDb } from "@/lib/data";

export default function Home() {
  return <TaskFlowyApp db={supabaseDb} />;
}
