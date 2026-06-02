# Audio Separation Backend

这个目录是独立的 FastAPI 后端，部署到 Render Docker Web Service。Python、ffmpeg、Demucs 和 torch 都只在这个容器里运行。

本地启动：

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Render 会提供 `PORT` 环境变量；没有 `PORT` 时 Docker 启动命令默认使用 `10000`。如果前端域名已经确定，把 `CORS_ORIGINS` 设置为逗号分隔列表，例如 `http://localhost:3000,https://fengye-rain.life,https://www.fengye-rain.life`。

接口包括 `GET /health`、`POST /api/jobs?mode=fast|quality`、`GET /api/jobs/{job_id}`、`GET /api/jobs/{job_id}/download/vocals`、`GET /api/jobs/{job_id}/download/instrumental`、`GET /api/jobs/{job_id}/download/guitar` 和 `GET /api/jobs/{job_id}/download/no_guitar`。所有临时文件写入 `/tmp/audio-jobs/`。
