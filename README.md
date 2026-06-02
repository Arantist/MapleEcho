# 伴奏分离工作台

这是一个本机单用户使用的 Next.js + Python/Demucs Web App。它不接外部 API，不做公网 SaaS；上传一个音频文件后，在本机调用 Demucs 分离 `vocals.mp3`、`instrumental.mp3`、`guitar.mp3` 和 `no_guitar.mp3`，页面支持状态轮询、错误提示、试听和下载。

## 环境

推荐 Python 3.11，次选 Python 3.12。不建议直接用 Python 3.14 跑 Demucs。Node 侧使用当前项目的 `package-lock.json` 安装依赖，音频探测依赖系统 `ffmpeg/ffprobe`。

```bash
npm install
brew install python@3.11 ffmpeg
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install torch torchaudio demucs diffq
```

## 启动

```bash
npm run dev
```

打开 `http://localhost:3000`，选择一个 `mp3`、`wav`、`flac`、`m4a`、`aac` 或 `ogg` 文件。当前限制单文件上传和 100MB 大小，只允许一个任务处于 queued/running 状态。

## API

`POST /api/jobs` 接收 `multipart/form-data`，字段是 `file` 和 `mode`。`mode` 只能是 `speed` 或 `quality`。接口保存文件、用 `ffprobe` 验证音频流、创建 `job.json`、启动后台 Python worker，然后立即返回 `{ id, status: "queued" }`。

`GET /api/jobs/[id]` 返回任务状态。`GET /api/jobs/[id]/files/vocals` 下载人声，`GET /api/jobs/[id]/files/instrumental` 下载无人声伴奏，`GET /api/jobs/[id]/files/guitar` 下载吉他，`GET /api/jobs/[id]/files/no_guitar` 下载无吉他版本。`GET /api/system/check` 检查 python、ffmpeg、ffprobe、demucs、torch 和 MPS。

## 数据目录

任务文件写入 `data/jobs/<jobId>/`，不会进入 Git。目录结构如下：

```text
input/original.<ext>
result/vocals.mp3
result/instrumental.mp3
result/guitar.mp3
result/no_guitar.mp3
job.json
logs/worker.log
```

## 模式

速度模式和质量模式都使用 Demucs `htdemucs_6s`，这个 6-stem 模型可以输出 guitar 和 piano。速度模式使用单次预测，质量模式使用 2 次 shift 平均。worker 会优先尝试 MPS；如果 MPS 处理失败，会写入 warning 并自动用 CPU 重试。

当前稳定输出的是整体吉他 stem 和无吉他版本。主音吉他、节奏吉他、无主音吉他、无节奏吉他需要专门模型或后续实验模式，不能由 Demucs 现成 stem 准确保证。

## 验证

```bash
npm test
npm run build
```
