# 伴奏分离工作台

这是一个前后端分离的音频分离 Web App。前端保留在当前 Next.js 项目中，部署到 Vercel；后端放在 `backend/`，使用 FastAPI + Demucs 部署到 Google Cloud VM。Python、ffmpeg、Demucs 和 torch 都只在 Google Cloud 后端运行，Vercel 负责页面、上传入口、任务状态展示、音频试听和下载按钮。

前端通过 HTTP API 调用后端。本地开发时前端跑 `http://localhost:3000`，后端跑 `http://localhost:8000`。线上默认走 Vercel rewrite：`/api/backend/*` 转发到 Google Cloud VM。

## 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 启动前端

```bash
npm install
npm run dev
```

前端 `.env.local`：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

访问：

```text
http://localhost:3000
```

## Google Cloud 部署

当前 Google Cloud VM：

```text
demucs-backend
asia-northeast1-a
136.110.67.247
```

后端部署到 `/opt/mapleecho-backend`，systemd 服务名是 `mapleecho-backend`，uvicorn 监听 `127.0.0.1:8000`，nginx 监听公网 80 并反代到后端。

后端 CORS：

```env
CORS_ORIGINS=http://localhost:3000,https://fengye-rain.life,https://www.fengye-rain.life
```

Vercel 前端默认不需要配置 `NEXT_PUBLIC_API_BASE_URL`。`next.config.ts` 已经把 `/api/backend/:path*` rewrite 到：

```text
http://136.110.67.247/:path*
```

如果后续配置 `api.fengye-rain.life` 和 HTTPS，可以把 `NEXT_PUBLIC_API_BASE_URL` 设置成 `https://api.fengye-rain.life`，或者把 rewrite 目标改成这个 HTTPS API。

## API 流程

上传流程是：选择音频文件，前端 `POST` 到后端 `/api/jobs?mode=fast|quality`，拿到 `jobId` 后每 2 秒轮询 `/api/jobs/{jobId}`，状态变成 `completed` 后展示 vocals、instrumental、guitar 和 no guitar 的试听与下载入口。

后端接口包括 `GET /health`、`POST /api/jobs`、`GET /api/jobs/{job_id}`、`GET /api/jobs/{job_id}/download/vocals`、`GET /api/jobs/{job_id}/download/instrumental`、`GET /api/jobs/{job_id}/download/guitar` 和 `GET /api/jobs/{job_id}/download/no_guitar`。所有临时文件写入 `/tmp/audio-jobs/`，第一版使用内存字典维护任务状态。

## 验证

```bash
npm test
npm run build
npm run check
```
