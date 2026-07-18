# Soundpad Quick Cut

> 从视频中快速截取音频片段，一键导入 Soundpad 音效板。

专为 [Soundpad](https://www.soundpad.net/) 用户设计的音频快剪工具。导入视频 → 拖拽波形选段 → 导出 WAV/MP3，流程轻量、按键驱动。


## 功能

- 拖拽 / 按钮导入视频（MP4、MKV、MOV、AVI、WebM），支持多文件批量导入至素材库
- 视频预览 + 音频波形可视化，原生滚动条平移，`Ctrl+滚轮` 缩放时间轴
- `I` / `O` 键打入出点，或鼠标拖拽波形直接选区，两端手柄微调
- 选区播放（自动跳入点 → 播到出点停止 → 再播重新从入点开始）
- 逐帧 / 逐秒步进（`←` `→` / `Shift+←` `Shift+→`），支持长按连击
- 导出 WAV / MP3，格式自动记忆，导出后自动打开所在文件夹
- 素材库：左侧面板管理多段素材，各自独立保留入出点
- 菜单栏隐藏，界面紧凑专注编辑区域
- 快捷键：`空格` / `I` / `O` / `P` / `Esc` / `Ctrl+E`


## 快捷键

| 按键 | 操作 |
|------|------|
| `空格` | 播放 / 暂停 |
| `I` | 打入点 |
| `O` | 打出点 |
| `P` | 预听选区 |
| `Esc` | 清除选区 |
| `←` `→` | 逐帧步进 |
| `Shift` + `←` `→` | 逐秒步进 |
| `Ctrl` + `E` | 导出音频 |
| `Ctrl` + `滚轮` | 缩放时间轴 |


## 下载

从 [Releases](https://github.com/nggezi/soundpad-quick-cut/releases) 页面下载：

- **便携版** (`Soundpad Quick Cut v*.*.*-portable.zip`) — 解压即用
- **安装包** (`Soundpad Quick Cut Setup v*.*.*.exe`) — NSIS 安装程序


## 开发

```bash
npm install
npm run dev          # 开发模式
npm run build        # 构建
npx electron-builder --dir --win --x64   # 打包便携版
npx electron-builder --win --x64         # 打包安装包
```

推送 `v*` 标签触发 GitHub Actions 自动构建：

```bash
git tag v1.7.0
git push origin v1.7.0
```


## 依赖与致谢

本项目建立在以下开源项目和行业标准之上：

| 项目 | 用途 | 许可 |
|------|------|------|
| [FFmpeg](https://ffmpeg.org/) | 音视频解码、波形提取、音频导出 | LGPL / GPL |
| [LosslessCut](https://github.com/mifi/lossless-cut) | 时间轴缩放、原生滚动条、编辑交互范式参考 | GPL-2.0 |
| [Electron](https://www.electronjs.org/) | 桌面应用框架 | MIT |
| [React](https://react.dev/) | 渲染 UI | MIT |
| [Vite](https://vitejs.dev/) | 开发与生产构建 | MIT |
| [TypeScript](https://www.typescriptlang.org/) | 类型系统 | Apache-2.0 |

时间轴 I/O 选区、时间码排布、传输控制等编辑范式参考了以下行业标准软件：

- [Adobe Premiere Pro](https://www.adobe.com/products/premiere.html)
- [DaVinci Resolve](https://www.blackmagicdesign.com/products/davinciresolve)

Soundpad 集成方面参考了 [Soundpad Remote Control API](https://www.soundpad.net/en/dev)（需正式版 Soundpad）。


## 许可

[![CC BY-NC-ND 4.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-nd/4.0/)

本软件采用 [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/) 许可协议。

- **署名** — 使用时必须注明原作者
- **非商业性使用** — 不得用于商业目的
- **禁止演绎** — 未经许可不得修改或分发修改版本

© 2026 nggezi