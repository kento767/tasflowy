-- ノードにメモ(自由テキスト)を追加。マインドマップ上でカード下に常時表示する
alter table public.nodes add column if not exists note text;
