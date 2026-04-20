const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://dnicdsjvqxthkktlcshe.supabase.co',
  process.env.SUPABASE_SECRET_KEY   // set in .env.local — never hardcode
);

async function run() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS public.posts (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      beer_id    uuid NOT NULL REFERENCES public.beers(id) ON DELETE CASCADE,
      content    text NOT NULL,
      photo_url  text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.post_reactions (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      reaction   text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(post_id, user_id, reaction)
    )`,
    `CREATE TABLE IF NOT EXISTS public.post_comments (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      content    text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE public.posts          ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE public.post_comments  ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='posts' AND policyname='posts_select_all') THEN
         CREATE POLICY posts_select_all ON public.posts FOR SELECT USING (true);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='posts' AND policyname='posts_insert_own') THEN
         CREATE POLICY posts_insert_own ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='posts' AND policyname='posts_delete_own') THEN
         CREATE POLICY posts_delete_own ON public.posts FOR DELETE USING (auth.uid() = user_id);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_reactions' AND policyname='reactions_select_all') THEN
         CREATE POLICY reactions_select_all ON public.post_reactions FOR SELECT USING (true);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_reactions' AND policyname='reactions_insert_own') THEN
         CREATE POLICY reactions_insert_own ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_reactions' AND policyname='reactions_delete_own') THEN
         CREATE POLICY reactions_delete_own ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_comments' AND policyname='comments_select_all') THEN
         CREATE POLICY comments_select_all ON public.post_comments FOR SELECT USING (true);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_comments' AND policyname='comments_insert_own') THEN
         CREATE POLICY comments_insert_own ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
       END IF;
     END $$`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='post_comments' AND policyname='comments_delete_own') THEN
         CREATE POLICY comments_delete_own ON public.post_comments FOR DELETE USING (auth.uid() = user_id);
       END IF;
     END $$`,
  ];

  for (const sql of statements) {
    const { error } = await sb.rpc('exec_sql', { sql });
    if (error) {
      console.log('Statement failed:', sql.substring(0, 60), '|', error.message);
    } else {
      console.log('OK:', sql.substring(0, 60));
    }
  }
}

run().catch(console.error);
