<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3f57b364-a05f-47f6-8652-a86bb4937da1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` based on `.env.example` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (if you use Gemini features)
3. Run the app:
   `npm run dev`

## Deploy na Netlify

1. Suba o repositório no GitHub/GitLab e crie um novo site na Netlify (Import from Git).
2. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Configure as variáveis de ambiente na Netlify (Site settings → Environment variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Em Supabase (Auth → URL Configuration), adicione o domínio da Netlify em **Site URL** e **Redirect URLs** (para login/cadastro por e-mail).

## Supabase (Banco de Dados)

1. Crie um projeto no Supabase.
2. Pegue em **Project Settings → API**:
   - `VITE_SUPABASE_URL` (Project URL)
   - `VITE_SUPABASE_ANON_KEY` (anon public)
3. Em **SQL Editor**, rode:

   ```sql
   create extension if not exists pgcrypto;

   create table if not exists public.links (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     name text not null,
     url text not null,
     category text not null,
     description text,
     bg_image text,
     created_at bigint not null default ((extract(epoch from now()) * 1000)::bigint)
   );

   alter table public.links enable row level security;

   create policy "links_select_own" on public.links
     for select using (auth.uid() = user_id);

   create policy "links_insert_own" on public.links
     for insert with check (auth.uid() = user_id);

   create policy "links_update_own" on public.links
     for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create policy "links_delete_own" on public.links
     for delete using (auth.uid() = user_id);

   create index if not exists links_user_id_created_at_idx on public.links (user_id, created_at desc);
   ```
