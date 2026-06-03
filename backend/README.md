# MapleEcho Backend

这个目录是独立的 FastAPI 后端，部署到 Google Cloud C4D VM。Python、ffmpeg、Demucs 和 torch 都只在这台后端服务器运行。

本地启动：

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

如果前端域名已经确定，把 `CORS_ORIGINS` 设置为逗号分隔列表，例如 `http://localhost:3000,https://fengye-rain.life,https://www.fengye-rain.life`。

接口包括 `GET /health`、`POST /api/jobs?target=guitar&mode=balanced|quality`、`GET /api/jobs/{job_id}` 和 `GET /outputs/{job_id}/{filename}`。后端只返回两个 MP3：目标轨道和去目标伴奏。所有临时文件写入 `/tmp/audio-jobs/`。
