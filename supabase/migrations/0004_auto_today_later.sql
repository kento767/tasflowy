-- 「今日やる/明日以降やる」の自動反映機能に必要なカラムを追加
-- dismissed_on: この日付の間だけ、そのノードを自動追加の対象から外す(手動で×した記録)
-- auto: そのlist_itemがノードの期限から自動生成されたものかどうか(手動ドラッグはfalse)

alter table public.nodes add column if not exists dismissed_on date;
alter table public.list_items add column if not exists auto boolean not null default false;
