# 忆枫 MapleEcho

这是一个前后端分离的吉他练习伴奏分离 Web App。前端部署到 Vercel；后端放在 `backend/`，使用 FastAPI + Demucs 部署到 Google Cloud C4D VM。Python、ffmpeg、Demucs 和 torch 都只在 Google Cloud 后端运行，Vercel 负责页面、上传入口、任务状态展示、音频试听和下载按钮。

前端通过 HTTP API 调用后端。本地开发时前端跑 `http://localhost:3000`，后端跑 `http://localhost:8000`。线上默认走 Vercel rewrite：`/api/backend/*` 转发到 Google Cloud VM。

## 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Google Cloud 后端 VM 使用 CPU wheel，避免安装 CUDA 依赖占满磁盘：

```bash
pip install -r requirements-cpu.txt
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

后端部署到 `/opt/mapleecho-backend`，systemd 服务名是 `mapleecho-backend`，uvicorn 监听 `0.0.0.0:8000`。旧服务器只保留为配置参考和数据备份，不按无缝迁移设计。

后端 CORS：

```env
CORS_ORIGINS=http://localhost:3000,https://fengye-rain.life,https://www.fengye-rain.life
```

Vercel 前端默认走 `/api/backend` rewrite。`next.config.ts` 使用 `BACKEND_API_BASE_URL`，未设置时本地回退到 `http://127.0.0.1:8000`。切换新 C4D 时，在 Vercel 设置：

```env
BACKEND_API_BASE_URL=http://<new-c4d-ip>:8000
```

如果后续配置 `api.fengye-rain.life` 和 HTTPS，可以把 `BACKEND_API_BASE_URL` 设置成 `https://api.fengye-rain.life`。如果希望浏览器直接请求后端，可以额外设置 `NEXT_PUBLIC_API_BASE_URL`。

## API 流程

上传流程是：选择目标轨道和音频文件，前端 `POST` 到后端 `/api/jobs?target=guitar&mode=balanced|quality`，拿到 `jobId` 后每 2 秒轮询 `/api/jobs/{jobId}`，状态变成 `completed` 后展示 `isolated` 和 `backing` 两个 MP3 的试听与下载入口。

后端接口包括 `GET /health`、`POST /api/jobs`、`GET /api/jobs/{job_id}` 和 `GET /outputs/{job_id}/{filename}`。支持的 target 是 `guitar`、`bass`、`drums`、`vocals`。标准模式使用 MP3 256kbps；质量模式使用 MP3 320kbps。所有临时文件写入 `/tmp/audio-jobs/`，任务状态暂时使用内存字典维护。

当前 Demucs 参数：

```bash
python -m demucs -n htdemucs_6s --two-stems=guitar --mp3 --mp3-bitrate 256 --mp3-preset 4 <input>
python -m demucs -n htdemucs --two-stems=bass --mp3 --mp3-bitrate 256 --mp3-preset 4 <input>
python -m demucs -n htdemucs --two-stems=drums --mp3 --mp3-bitrate 256 --mp3-preset 4 <input>
python -m demucs -n htdemucs --two-stems=vocals --mp3 --mp3-bitrate 256 --mp3-preset 4 <input>
```

质量模式会追加 `--mp3-bitrate 320 --mp3-preset 2 --overlap 0.35 --shifts 2`。

## 验证

```bash
npm test
npm run build
npm run check
python3 -m unittest backend/test_demucs_runner.py
```
