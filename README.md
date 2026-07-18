# Soundpad Quick Cut

> 从视频中快速截取音频片段，一键导出到 Soundpad 音效板。

音频快剪工具。导入视频 → 拖拽波形选段 → 导出 WAV/MP3，专为 [Soundpad](https://www.soundpad.net/) 用户设计。

## 截图

![screenshot](https://github.com/user-attachments/assets/placeholder)

## 功能

- 拖拽 / 按钮导入视频（MP4、MKV、MOV、AVI、WebM），支持多文件批量导入
- 视频预览 + 音频波形可视化，原生滚动条平移，Ctrl+滚轮缩放
- I / O 键打入出点，或鼠标拖拽波形直接选区，两端手柄微调
- 选区循环播放（自动跳入点 → 播到出点停止 → 再次播放重新从入点开始）
- 逐帧 / 逐秒步进（← → / Shift+← →），按钮和键盘均支持长按连击
- 导出 WAV / MP3，格式自动记忆
- **素材库**：左侧面板管理多段素材，各自独立保留入出点
- **Soundpad 一键导出**：导出后自动打开所在文件夹（Soundpad Remote Control API 待正式版适配）
- 菜单栏隐藏，界面尽量干净
- 快捷键：空格 / I / O / P / Esc / Ctrl+E

## 快捷键

| 按键 | 操作 |
|------|------|
| `空格` | 播放 / 暂停 |
| `I` | 打入点 |
| `O` | 打出点 |
| `P` | 预听选区 |
| `Esc` | 清除选区 |
| `← →` | 逐帧步进 |
| `Shift + ← →` | 逐秒步进 |
| `Ctrl + E` | 导出音频 |
| `Ctrl + 滚轮` | 缩放时间轴 |

## 下载

从 [Releases](https://github.com/nggezi/soundpad-quick-cut/releases) 页面下载最新版本：

- **便携版**：`Soundpad Quick Cut v*.*.*.zip`，解压即用
- **安装包**：`Soundpad Quick Cut Setup v*.*.*.exe`，NSIS 安装程序

## 技术栈

- [Electron](https://www.electronjs.org/) 33 — 桌面窗口
- [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) — 渲染 UI
- [Vite](https://vitejs.dev/) 5 — 开发构建
- [FFmpeg](https://ffmpeg.org/)（ffmpeg-static + ffprobe-static）— 音视频解码、波形提取、音频导出

## 开发

```bash
npm install
npm run dev          # 开发模式（热重载）
npm run build        # 生产构建
npx electron-builder --dir --win --x64   # 打包便携版
npx electron-builder --win --x64         # 打包 NSIS 安装包
```

推送版本标签自动触发 GitHub Actions 构建：

```bash
git tag v1.7.0
git push origin v1.7.0
```

## 致谢

本项目的时间轴缩放、原生滚动条设计和编辑交互范式参考了以下开源项目与行业标准：

- [LosslessCut](https://github.com/mifi/lossless-cut) — 42k ⭐ 的无损视频剪辑器，MIT 协议
- [Adobe Premiere Pro](https://www.adobe.com/products/premiere.html) / [DaVinci Resolve](https://www.blackmagicdesign.com/products/davinciresolve) — 视频编辑行业标准的 I/O 选区与时间码布局
- [Soundpad](https://www.soundpad.net/) — Windows 音效板，Leppsoft 开发

## 许可协议

本软件采用 [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) 许可协议。

- **BY（署名）**：使用时必须注明原作者
- **NC（非商业性使用）**：不得用于商业目的
- **ND（禁止演绎）**：未经许可不得修改、分发修改版

© 2026 nggezi
