# Soundpad Quick Cut

音频快剪工具 —— 从视频中快速截取音频片段，一键导出到 [Soundpad](https://www.soundpad.net/) 音效板。

## 功能

- 拖拽导入视频（MP4/MKV/MOV/AVI/WebM），支持多文件批量导入
- 视频预览 + 音频波形可视化，支持缩放和平移
- I/O 键打入出点，或鼠标拖拽波形选区，手柄微调
- 选区播放（自动跳入点→播到出点→再播重新从入点开始）
- 逐帧/逐秒步进（← → / Shift+← →），支持长按连击
- 导出 WAV/MP3，格式自动记忆
- **素材库**：左侧栏管理多段素材，各自保留选区
- **Soundpad 一键导出**：导出后自动打开文件夹
- 原生滚动条、Ctrl+滚轮缩放（以指针为中心）
- 快捷键：空格/I/O/P/Esc/Ctrl+E

## 快捷键

| 按键 | 操作 |
|------|------|
| 空格 | 播放 / 暂停 |
| I | 打入点 |
| O | 打出点 |
| P | 预听选区 |
| Esc | 清除选区 |
| ← → | 逐帧步进 |
| Shift+← → | 逐秒步进 |
| Ctrl+E | 导出 |
| Ctrl+滚轮 | 缩放时间轴 |

## 技术栈

- **Electron 33** — 桌面窗口
- **React 18 + TypeScript** — 渲染 UI
- **Vite 5** — 构建
- **FFmpeg**（ffmpeg-static + ffprobe-static）— 音视频处理
- **electron-builder** — 打包

## 借鉴的开源项目

- [LosslessCut](https://github.com/mifi/lossless-cut) — 42k ⭐ 的无损视频剪辑器，借鉴了其时间轴缩放和原生滚动条设计
- [Adobe Premiere Pro](https://www.adobe.com/products/premiere.html) / [DaVinci Resolve](https://www.blackmagicdesign.com/products/davinciresolve) — 视频编辑行业标准，借鉴了 I/O 选区、JKL 穿梭、时间码布局等编辑范式

## 开源标准

- **Soundpad Remote Control API** — 通过 Windows 命名管道与 Soundpad 通信（需要正式版 Soundpad）
- **FFmpeg** — 遵循 FFmpeg 命令行接口标准进行音频提取和波形分析
- **Semantic Versioning** — 版本号遵循 semver 规范，每次功能改动递增 minor 版本

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 打包便携版
npx electron-builder --dir --win --x64

# 打包安装包
npx electron-builder --win --x64
```

## 构建

推送 `v*` 标签自动触发 GitHub Actions 构建，产出便携版和 NSIS 安装包。

```bash
git tag v1.7.0
git push origin v1.7.0
```

## License

MIT
