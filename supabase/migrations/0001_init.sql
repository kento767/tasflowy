-- 進捗帖: 初期スキーマ

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  type text not null check (type in ('must', 'want')),
  due_date date,
  flagged boolean not null default false,
  note text not null default '',
  status text not null default 'active' check (status in ('active', 'done')),
  repeat text check (repeat in ('daily', 'weekly', 'monthly')),
  origin_task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  completed_at timestamptz,
  sort_order integer not null default 0,
  linked_task_id uuid references public.tasks (id) on delete set null
);

create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_origin_task_id_idx on public.tasks (origin_task_id);
create index subtasks_task_id_idx on public.subtasks (task_id);
create index subtasks_linked_task_id_idx on public.subtasks (linked_task_id);

alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;

create policy "own_tasks" on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own_subtasks" on public.subtasks
  for all to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id and t.user_id = (select auth.uid())
    )
  );

-- サブタスクを独立タスクに昇格する（要件 4.3 / 1トランザクション）
-- 1. 新タスクをINSERT（title/typeは親から引き継ぎ、due_dateはNULL、origin_task_idに親のid）
-- 2. 元サブタスクの linked_task_id に新タスクのidをセット
create or replace function public.promote_subtask(p_subtask_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sub public.subtasks%rowtype;
  v_parent public.tasks%rowtype;
  v_new_id uuid;
begin
  select * into v_sub from public.subtasks where id = p_subtask_id for update;
  if not found then
    raise exception 'subtask not found';
  end if;
  if v_sub.linked_task_id is not null then
    raise exception 'subtask is already promoted';
  end if;

  select * into v_parent from public.tasks where id = v_sub.task_id;

  insert into public.tasks (user_id, title, type, due_date, origin_task_id)
  values (v_parent.user_id, v_sub.title, v_parent.type, null, v_parent.id)
  returning id into v_new_id;

  update public.subtasks
  set linked_task_id = v_new_id, done = false, completed_at = null
  where id = p_subtask_id;

  return v_new_id;
end;
$$;

-- タスクを完了にする（要件 4.4 / repeat の次回分生成を含む1トランザクション）
-- p_today はクライアントのローカル日付（タイムゾーンずれ対策）
create or replace function public.complete_task(p_task_id uuid, p_today date default current_date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_next date;
  v_new_id uuid;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'task not found';
  end if;
  if v_task.status = 'done' then
    return;
  end if;

  update public.tasks
  set status = 'done', completed_at = now()
  where id = p_task_id;

  if v_task.repeat is not null then
    -- 次回の期限: 元の期限（なければ今日）から間隔を足し、今日以前なら今日より後まで進める
    v_next := coalesce(v_task.due_date, p_today);
    loop
      v_next := case v_task.repeat
        when 'daily' then v_next + 1
        when 'weekly' then v_next + 7
        when 'monthly' then (v_next + interval '1 month')::date
      end;
      exit when v_next > p_today;
    end loop;

    insert into public.tasks (user_id, title, type, due_date, flagged, note, repeat)
    values (v_task.user_id, v_task.title, v_task.type, v_next, v_task.flagged, v_task.note, v_task.repeat)
    returning id into v_new_id;

    -- サブタスクは未チェック状態でコピーする（昇格リンクは引き継がない）
    insert into public.subtasks (task_id, title, sort_order)
    select v_new_id, s.title, s.sort_order
    from public.subtasks s
    where s.task_id = p_task_id
    order by s.sort_order;
  end if;
end;
$$;
