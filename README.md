# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Local run (Docker Compose)

From repo root, ensure `.env` has Telegram credentials and Postgres vars (see `backend/` and `services/telegram/`). Then:

```bash
./scripts/run.sh compose-local
```

- **Frontend:** http://localhost:5175 (Vite dev server in container; `VITE_API_URL=http://localhost:8000`)
- **API:** http://localhost:8000
- **Telegram microservice:** http://localhost:8002 (used by API for avatars/ingest; avatars in browser load from this URL)

Check: http://localhost:5175 → open a page that uses `/debug/eco-channels` or `/debug/channel-avatar` (e.g. PipeRotate) and confirm avatars load. API calls telegram at `http://telegram:8000` inside Docker; redirects/avatar URLs use `TELEGRAM_MEDIA_PUBLIC_URL=http://localhost:8002` so the browser can load images.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is currently not compatible with SWC. See [this issue](https://github.com/vitejs/vite-plugin-react/issues/428) for tracking the progress.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
