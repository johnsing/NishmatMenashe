-- ============================================================================
-- NishmatMenashe Library — Supabase schema
-- Replaces the FastAPI + MongoDB backend entirely.
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables (column names kept identical to the old MongoDB documents,
--    so the frontend TypeScript interfaces still match)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  picture text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  category_id text primary key,
  title text not null,
  description text not null,
  accent_color text not null,
  "order" int not null default 0
);

create table if not exists public.books (
  book_id text primary key,
  category_id text not null references public.categories (category_id) on delete cascade,
  title text not null,
  author text not null,
  description text not null,
  chapter_count int not null default 0,
  cover_color text not null,
  "order" int not null default 0
);

create table if not exists public.chapters (
  chapter_id text primary key,
  book_id text not null references public.books (book_id) on delete cascade,
  chapter_number int not null,
  title text not null,
  verse_count int not null default 0
);

create table if not exists public.verses (
  verse_id text primary key,
  chapter_id text not null references public.chapters (chapter_id) on delete cascade,
  verse_number int not null,
  original_text text not null,
  english_translation text not null
);

create table if not exists public.bookmarks (
  bookmark_id text primary key default ('bookmark_' || substr(gen_random_uuid()::text, 1, 12)),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  book_id text not null,
  chapter_id text not null,
  verse_id text not null references public.verses (verse_id) on delete cascade,
  book_title text not null,
  chapter_title text not null,
  verse_number int not null,
  created_at timestamptz not null default now(),
  unique (user_id, verse_id) -- one bookmark per verse per user
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------

create index if not exists books_category_idx on public.books (category_id);
create index if not exists chapters_book_idx on public.chapters (book_id);
create index if not exists verses_chapter_idx on public.verses (chapter_id);
create index if not exists verses_english_fts_idx on public.verses using gin (to_tsvector('english', english_translation));
create index if not exists bookmarks_user_idx on public.bookmarks (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Helper: is_admin()
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Auto-create profile on signup (and auto-promote the admin email)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, picture, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url',
    case when lower(new.email) = 'tzurielsingson@gmail.com' then 'admin' else 'user' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. Auto-sync chapter_count / verse_count (replaces backend recompute logic)
-- ---------------------------------------------------------------------------

create or replace function public.sync_book_count()
returns trigger language plpgsql as $$
begin
  update public.books b
     set chapter_count = (select count(*) from public.chapters c where c.book_id = b.book_id)
   where b.book_id = coalesce(new.book_id, old.book_id);
  return coalesce(new, old);
end $$;

create or replace function public.sync_chapter_count()
returns trigger language plpgsql as $$
begin
  update public.chapters c
     set verse_count = (select count(*) from public.verses v where v.chapter_id = c.chapter_id)
   where c.chapter_id = coalesce(new.chapter_id, old.chapter_id);
  return coalesce(new, old);
end $$;

drop trigger if exists chapters_sync on public.chapters;
create trigger chapters_sync after insert or delete on public.chapters
  for each row execute function public.sync_book_count();

drop trigger if exists verses_sync on public.verses;
create trigger verses_sync after insert or delete on public.verses
  for each row execute function public.sync_chapter_count();

-- ---------------------------------------------------------------------------
-- 6. Search function (replaces GET /api/search)
-- ---------------------------------------------------------------------------

create or replace function public.search_verses(q text)
returns table (
  verse_id text, book_id text, book_title text, chapter_id text,
  chapter_number int, verse_number int,
  original_text text, english_translation text
) language sql stable as $$
  select v.verse_id, b.book_id, b.title, v.chapter_id, c.chapter_number,
         v.verse_number, v.original_text, v.english_translation
    from public.verses v
    join public.chapters c on c.chapter_id = v.chapter_id
    join public.books b    on b.book_id = c.book_id
   where to_tsvector('english', v.english_translation) @@ plainto_tsquery('english', q)
      or v.original_text ilike '%' || q || '%'
   order by c.book_id, c.chapter_number, v.verse_number
   limit 50;
$$;

-- ---------------------------------------------------------------------------
-- 7. Admin analytics (replaces GET /api/admin/analytics)
-- ---------------------------------------------------------------------------

create or replace function public.admin_analytics()
returns json language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select json_build_object(
    'total_users',       (select count(*) from public.profiles),
    'admin_count',       (select count(*) from public.profiles where role = 'admin'),
    'total_categories',  (select count(*) from public.categories),
    'total_books',       (select count(*) from public.books),
    'total_chapters',    (select count(*) from public.chapters),
    'total_verses',      (select count(*) from public.verses),
    'total_bookmarks',   (select count(*) from public.bookmarks),
    'top_bookmarked',    coalesce((select json_agg(t) from (
                             select verse_id, count(*) as count, max(book_title) as book_title,
                                    max(chapter_title) as chapter_title, max(verse_number) as verse_number
                               from public.bookmarks
                              group by verse_id
                              order by count(*) desc
                              limit 5
                           ) t), '[]'::json)
  ) into result;

  return result;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.categories  enable row level security;
alter table public.books       enable row level security;
alter table public.chapters    enable row level security;
alter table public.verses      enable row level security;
alter table public.bookmarks   enable row level security;

-- Profiles: everyone reads their own; admins read all.
create policy profiles_select_own   on public.profiles for select using (auth.uid() = id);
create policy profiles_select_admin on public.profiles for select using (public.is_admin());
create policy profiles_update_own   on public.profiles for update using (auth.uid() = id);

-- Library content: any signed-in user can read; only admins can write.
create policy categories_read   on public.categories for select using (auth.role() = 'authenticated');
create policy categories_insert on public.categories for insert with check (public.is_admin());
create policy categories_update on public.categories for update using (public.is_admin());
create policy categories_delete on public.categories for delete using (public.is_admin());

create policy books_read   on public.books for select using (auth.role() = 'authenticated');
create policy books_insert on public.books for insert with check (public.is_admin());
create policy books_update on public.books for update using (public.is_admin());
create policy books_delete on public.books for delete using (public.is_admin());

create policy chapters_read   on public.chapters for select using (auth.role() = 'authenticated');
create policy chapters_insert on public.chapters for insert with check (public.is_admin());
create policy chapters_update on public.chapters for update using (public.is_admin());
create policy chapters_delete on public.chapters for delete using (public.is_admin());

create policy verses_read   on public.verses for select using (auth.role() = 'authenticated');
create policy verses_insert on public.verses for insert with check (public.is_admin());
create policy verses_update on public.verses for update using (public.is_admin());
create policy verses_delete on public.verses for delete using (public.is_admin());

-- Bookmarks: strictly private to each user.
create policy bookmarks_read   on public.bookmarks for select using (auth.uid() = user_id);
create policy bookmarks_insert on public.bookmarks for insert with check (auth.uid() = user_id);
create policy bookmarks_delete on public.bookmarks for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 9. Seed data (idempotent — safe to re-run)
-- ---------------------------------------------------------------------------

insert into public.categories (category_id, title, description, accent_color, "order") values
  ('cat_tanakh',       'Tanakh',        'Torah, Prophets, and Writings, which together make up the Hebrew Bible, Judaism''s foundational text.', '#2C5F5D', 1),
  ('cat_mishnah',      'Mishnah',       'First major work of rabbinic literature, compiled around 200 CE, documenting a multiplicity of legal opinions in the oral tradition.', '#D4A017', 2),
  ('cat_talmud',       'Talmud',        'Generations of rabbinic debate about law, ethics, and Bible, structured as commentary on the Mishnah with stories interwoven.', '#6B9AC4', 3),
  ('cat_midrash',      'Midrash',       'Interpretations and elaborations upon biblical texts, including stories, parables, and legal deductions.', '#2E7D32', 4),
  ('cat_halakhah',     'Halakhah',      'Legal works providing guidance on all aspects of Jewish life. Rooted in past sources and growing to address changing realities.', '#8B1A1A', 5),
  ('cat_kabbalah',     'Kabbalah',      'Mystical works addressing topics like God''s attributes and the relationship between God''s eternality and the finite universe.', '#1A237E', 6),
  ('cat_liturgy',      'Liturgy',       'Prayers, poems, and ritual texts, like Siddur and Haggadah, recited in daily worship or at specific occasions.', '#AD1457', 7),
  ('cat_jewish_thought','Jewish Thought','Jewish philosophy and theology, ranging from medieval to contemporary, analyzing topics like free will and chosenness.', '#8B1A1A', 8)
on conflict (category_id) do nothing;

insert into public.books (book_id, category_id, title, author, description, chapter_count, cover_color, "order") values
  ('book_bereishit','cat_tanakh','Bereishit','Genesis','The first book of the Torah, beginning with Creation and ending with the descent to Egypt.',3,'#8B7355',1),
  ('book_shemot','cat_tanakh','Shemot','Exodus','The story of liberation from Egypt and the giving of the Torah at Sinai.',3,'#A0522D',2),
  ('book_vayikra','cat_tanakh','Vayikra','Leviticus','Laws of sacrifices, priesthood, ritual purity, and holiness for the community of Israel.',2,'#CD853F',3),
  ('book_bamidbar','cat_tanakh','Bamidbar','Numbers','The wanderings of Israel through the wilderness on the journey to the Promised Land.',2,'#D2691E',4),
  ('book_devarim','cat_tanakh','Devarim','Deuteronomy','Moses'' final addresses to the Israelites, reviewing the laws and preparing them to enter the land.',2,'#B8860B',5)
on conflict (book_id) do nothing;

insert into public.chapters (chapter_id, book_id, chapter_number, title, verse_count) values
  ('ch_bereishit_1','book_bereishit',1,'Creation',5),
  ('ch_bereishit_2','book_bereishit',2,'The Garden',3),
  ('ch_bereishit_3','book_bereishit',3,'The Fall',3),
  ('ch_shemot_1','book_shemot',1,'Names',3),
  ('ch_shemot_2','book_shemot',2,'Moses'' Birth',0),
  ('ch_shemot_3','book_shemot',3,'The Burning Bush',3),
  ('ch_vayikra_1','book_vayikra',1,'Offerings',0),
  ('ch_vayikra_2','book_vayikra',2,'Meal Offerings',0),
  ('ch_bamidbar_1','book_bamidbar',1,'The Census',0),
  ('ch_bamidbar_2','book_bamidbar',2,'The Camp',0),
  ('ch_devarim_1','book_devarim',1,'Moses'' Address',0),
  ('ch_devarim_2','book_devarim',2,'Review of Laws',0)
on conflict (chapter_id) do nothing;

insert into public.verses (verse_id, chapter_id, verse_number, original_text, english_translation) values
  ('v_bereishit_1_1','ch_bereishit_1',1,'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ','In the beginning God created the heaven and the earth.'),
  ('v_bereishit_1_2','ch_bereishit_1',2,'וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם','And the earth was without form and void, and darkness was upon the face of the deep.'),
  ('v_bereishit_1_3','ch_bereishit_1',3,'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי־אוֹר','And God said: Let there be light. And there was light.'),
  ('v_bereishit_1_4','ch_bereishit_1',4,'וַיַּרְא אֱלֹהִים אֶת־הָאוֹר כִּי־טוֹב','And God saw the light, that it was good.'),
  ('v_bereishit_1_5','ch_bereishit_1',5,'וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם וְלַחֹשֶׁךְ קָרָא לָיְלָה','And God called the light Day, and the darkness He called Night.'),
  ('v_bereishit_2_1','ch_bereishit_2',1,'וַיְכֻלּוּ הַשָּׁמַיִם וְהָאָרֶץ וְכָל־צְבָאָם','And the heaven and the earth were finished, and all their host.'),
  ('v_bereishit_2_2','ch_bereishit_2',2,'וַיְכַל אֱלֹהִים בַּיּוֹם הַשְּׁבִיעִי מְלַאכְתּוֹ אֲשֶׁר עָשָׂה','And on the seventh day God finished His work which He had made.'),
  ('v_bereishit_2_3','ch_bereishit_2',3,'וַיְבָרֶךְ אֱלֹהִים אֶת־יוֹם הַשְּׁבִיעִי וַיְקַדֵּשׁ אֹתוֹ','And God blessed the seventh day, and hallowed it.'),
  ('v_bereishit_3_1','ch_bereishit_3',1,'וְהַנָּחָשׁ הָיָה עָרוּם מִכֹּל חַיַּת הַשָּׂדֶה','Now the serpent was more subtle than any beast of the field.'),
  ('v_bereishit_3_2','ch_bereishit_3',2,'וַתֹּאמֶר הָאִשָּׁה אֶל־הַנָּחָשׁ מִפְּרִי עֵץ־הַגָּן נֹאכֵל','And the woman said unto the serpent: Of the fruit of the trees of the garden we may eat.'),
  ('v_bereishit_3_3','ch_bereishit_3',3,'וּמִפְּרִי הָעֵץ אֲשֶׁר בְּתוֹךְ־הַגָּן אָמַר אֱלֹהִים לֹא תֹאכְלוּ מִמֶּנּוּ','But of the fruit of the tree which is in the midst of the garden, God hath said: Ye shall not eat of it.'),
  ('v_shemot_1_1','ch_shemot_1',1,'וְאֵלֶּה שְׁמוֹת בְּנֵי יִשְׂרָאֵל הַבָּאִים מִצְרָיְמָה','Now these are the names of the children of Israel who came into Egypt.'),
  ('v_shemot_1_2','ch_shemot_1',2,'רְאוּבֵן שִׁמְעוֹן לֵוִי וִיהוּדָה','Reuben, Simeon, Levi, and Judah.'),
  ('v_shemot_1_3','ch_shemot_1',3,'יִשָּׂשכָר זְבוּלֻן וּבִנְיָמִן','Issachar, Zebulun, and Benjamin.'),
  ('v_shemot_3_1','ch_shemot_3',1,'וּמֹשֶׁה הָיָה רֹעֶה אֶת־צֹאן יִתְרוֹ חֹתְנוֹ כֹּהֵן מִדְיָן','Now Moses was keeping the flock of Jethro his father-in-law, the priest of Midian.'),
  ('v_shemot_3_2','ch_shemot_3',2,'וַיֵּרָא מַלְאַךְ יְהוָה אֵלָיו בְּלַבַּת־אֵשׁ מִתּוֹךְ הַסְּנֶה','And the angel of the Lord appeared unto him in a flame of fire out of the midst of a bush.'),
  ('v_shemot_3_3','ch_shemot_3',3,'וַיֹּאמֶר מֹשֶׁה אָסֻרָה־נָּא וְאֶרְאֶה אֶת־הַמַּרְאֶה הַגָּדֹל הַזֶּה','And Moses said: I will turn aside now, and see this great sight.')
on conflict (verse_id) do nothing;
