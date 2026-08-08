-- アプリの実装(ツリー構造のnodes + 今日/後でのlist_items)に対応するテーブルを作成
-- 0001/0002 で作られた tasks/subtasks は現在のアプリコードからは使われていない
-- (実装が要件定義から進化し、ノードのツリー構造に変わったため)

create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.nodes (id) on delete cascade,
  title text not null,
  due_date date,
  note text,
  status text not null default 'todo' check (status in ('todo', 'active', 'done')),
  next_flag boolean not null default false,
  done_date date,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list text not null check (list in ('today', 'later')),
  title text not null,
  path text not null,
  due_date date,
  node_id uuid references public.nodes (id) on delete set null,
  checked boolean not null default false,
  listed_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists nodes_user_parent_idx on public.nodes (user_id, parent_id);
create index if not exists nodes_parent_id_idx on public.nodes (parent_id);
create index if not exists list_items_user_list_idx on public.list_items (user_id, list);
create index if not exists list_items_node_id_idx on public.list_items (node_id);

alter table public.nodes enable row level security;
alter table public.list_items enable row level security;

create policy "own_nodes" on public.nodes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own_list_items" on public.list_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
