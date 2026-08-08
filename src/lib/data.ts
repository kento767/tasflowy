import { createClient } from "@/lib/supabase/client";
import type { ListItem, ListName, NodeRow, NodeStatus } from "./types";

/** アプリが必要とするデータ操作一式。本番はSupabase、/previewはメモリ実装 */
export interface DataSource {
  fetchNodes(): Promise<NodeRow[]>;
  createNode(input: {
    parent_id: string | null;
    title: string;
    due_date: string | null;
    note: string | null;
    sort_order: number;
  }): Promise<NodeRow>;
  updateNode(
    id: string,
    patch: Partial<
      Pick<
        NodeRow,
        | "title"
        | "due_date"
        | "note"
        | "status"
        | "next_flag"
        | "done_date"
        | "sort_order"
        | "dismissed_on"
      >
    >
  ): Promise<void>;
  deleteNode(id: string): Promise<void>;
  fetchListItems(): Promise<ListItem[]>;
  createListItem(input: {
    list: ListName;
    title: string;
    path: string;
    due_date: string | null;
    node_id: string | null;
    listed_on: string;
    auto?: boolean;
  }): Promise<ListItem>;
  updateListItem(
    id: string,
    patch: Partial<Pick<ListItem, "checked" | "list" | "listed_on">>
  ): Promise<void>;
  deleteListItem(id: string): Promise<void>;
}

export async function fetchNodes(): Promise<NodeRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nodes")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as NodeRow[];
}

export async function createNode(input: {
  parent_id: string | null;
  title: string;
  due_date: string | null;
  note: string | null;
  sort_order: number;
}): Promise<NodeRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("nodes")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as NodeRow;
}

export async function updateNode(
  id: string,
  patch: Partial<{
    title: string;
    due_date: string | null;
    note: string | null;
    status: NodeStatus;
    next_flag: boolean;
    done_date: string | null;
    sort_order: number;
    dismissed_on: string | null;
  }>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("nodes").update(patch).eq("id", id);
  if (error) throw error;
}

/** 子孫はDBのON DELETE CASCADEで一緒に消える */
export async function deleteNode(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("nodes").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchListItems(): Promise<ListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("list_items")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as ListItem[];
}

export async function createListItem(input: {
  list: ListName;
  title: string;
  path: string;
  due_date: string | null;
  node_id: string | null;
  listed_on: string;
  auto?: boolean;
}): Promise<ListItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("list_items")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as ListItem;
}

export async function updateListItem(
  id: string,
  patch: Partial<Pick<ListItem, "checked" | "list" | "listed_on">>
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("list_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteListItem(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("list_items").delete().eq("id", id);
  if (error) throw error;
}

export const supabaseDb: DataSource = {
  fetchNodes,
  createNode,
  updateNode,
  deleteNode,
  fetchListItems,
  createListItem,
  updateListItem,
  deleteListItem,
};
