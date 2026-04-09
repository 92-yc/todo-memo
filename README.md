# 暖笺待办

![暖笺待办图标](./build/%E6%9A%96%E7%AC%BA%E5%BE%85%E5%8A%9E-%E5%9B%BE%E6%A0%87.png)

一个面向 Windows 的本地待办便签应用，风格参考苹果备忘录，适合把自由记录和任务清单放在同一张便签里。

## 功能特性

- 左侧便签列表，支持搜索和置顶
- 中间正文编辑区，适合记录灵感、会议内容和日常笔记
- 右侧待办清单和完成进度
- 自动保存到本地，不依赖联网
- 支持 JSON 备份导入和导出
- 支持全局快捷键 `Ctrl + Alt + N` 唤起窗口

## 适用场景

- 记录今天要做的事情
- 会议纪要和执行事项放在同一张便签里
- 临时灵感、购物清单、工作备忘快速整理

## 本地开发

```powershell
npm install
npm run dev
```

## 本地运行

```powershell
npm start
```

## 打包 Windows 安装包

```powershell
npm run dist:win
```

打包完成后，安装包会输出到：

```text
release/暖笺待办-安装包-0.1.0.exe
```

便携版可执行文件会输出到：

```text
release/win-unpacked/暖笺待办.exe
```

## 项目结构

```text
electron/   Electron 主进程与本地存储桥接
src/        React 前端界面
build/      图标资源
scripts/    构建脚本
```

## 技术栈

- Electron
- React
- TypeScript
- Vite
- electron-builder

## 说明

- 当前仓库默认提交源码，不提交打包产物
- Windows 第一次运行安装包时，可能会看到 SmartScreen 提示，这通常是因为未做代码签名
