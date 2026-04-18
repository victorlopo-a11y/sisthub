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
