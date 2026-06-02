# 伴奏分离工作台

这是一个前后端分离的音频分离 Web App。前端保留在当前 Next.js 项目中，可以部署到 Vercel；后端放在 `backend/`，使用 FastAPI + Docker 部署到 Render Web Service。Python、ffmpeg、Demucs 和 torch 都只在 Render 后端容器里运行，Vercel 只负责页面、上传入口、任务状态展示、音频试听和下载按钮。

前端通过 `NEXT_PUBLIC_API_BASE_URL` 调用后端。本地开发时前端跑 `http://localhost:3000`，后端跑 `http://localhost:8000`。

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

## Render 部署

在 Render 创建 Docker Web Service，根目录选择 `backend`。服务必须监听 `0.0.0.0` 和环境变量 `PORT`，当前 Dockerfile 的启动命令已经处理：没有 `PORT` 时默认使用 `10000`。

如果线上前端域名已确定，在 Render 环境变量中配置：

```env
CORS_ORIGINS=http://localhost:3000,https://your-vercel-app.vercel.app
```

Vercel 前端环境变量配置为 Render 后端地址：

```env
NEXT_PUBLIC_API_BASE_URL=https://your-audio-backend.onrender.com
```

## API 流程

上传流程是：选择音频文件，前端 `POST` 到后端 `/api/jobs?mode=fast|quality`，拿到 `jobId` 后每 2 秒轮询 `/api/jobs/{jobId}`，状态变成 `completed` 后展示 vocals 和 instrumental 的试听与下载入口。

后端接口包括 `GET /health`、`POST /api/jobs`、`GET /api/jobs/{job_id}`、`GET /api/jobs/{job_id}/download/vocals` 和 `GET /api/jobs/{job_id}/download/instrumental`。所有临时文件写入 `/tmp/audio-jobs/`，第一版使用内存字典维护任务状态。

## 验证

```bash
npm test
npm run build
```
