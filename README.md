# DSH 翻译与朗读

为 DeepSeek Harness 每条已完成的助手回复添加扬声器和翻译按钮，与复制、点赞同排。点击翻译会在原文下方展开译文，可单独朗读或收起；朗读中再次点击即停止。不会改写对话，也不读取思考过程、工具输出或整段历史。只在点击时处理文字。

[快速安装](#快速安装) · [功能](#功能) · [服务配置](#服务配置) · [DSH 插件规范](#dsh-插件规范) · [开发与验证](#开发与验证)

## 功能

| 在哪里 | 怎么用 |
| --- | --- |
| 回复工具栏 | 在点赞、点踩右侧选择「朗读原文」或「翻译」。播放中再次点击即可停止。 |
| 原回复下方 | 展开译文后，选择「朗读译文」播放翻译结果，或选择「收起译文」继续阅读。 |
| 设置 → 翻译与朗读 | 默认中英互译，也可指定目标语言。翻译和朗读可以连接不同服务。 |

## 快速安装

从 GitHub Release 下载 `dsh-reply-reader-1.0.1.tgz`。安装包已包含客户端和适用于 Apple 芯片与 Intel Mac 的翻译程序。

**桌面端**：打开 DSH 的「插件」页，填写安装包的绝对路径并启用插件，按提示重新打开客户端。使用桌面版提供的 `dsh` 命令时，先退出桌面应用，再在安装包所在目录运行：

```sh
dsh plugin --profile desktop add ./dsh-reply-reader-1.0.1.tgz
```

**Web 端**：将安装包放到运行 DSH 的机器上，在安装包所在目录运行以下命令，再重启 Web 实例：

```sh
dsh plugin --profile web add ./dsh-reply-reader-1.0.1.tgz
```

从源码安装时，可将命令中的 `.tgz` 路径换为仓库目录的绝对路径。卸载可在同一「插件」页选择移除。

## 服务配置

打开 **设置 → 翻译与朗读**。翻译与朗读分别选服务，可以一个用系统，一个用 API。

- **Mac**：默认本机处理。朗读使用系统 `say`；翻译使用 Apple Translation（macOS 15+），需先在系统设置的「语言与地区」下载源语言和目标语言。默认中英互译，亦可固定目标语言。缺少语言包或不支持语言时不会悄悄转发给云服务。
- **Windows / Linux**：未配置时点击会显示「前往设置」。选择自定义 API，填写服务实际提供的模型 ID 和地址，例如 `http://127.0.0.1:8000/v1`。本地模型需先由兼容服务运行；不直接加载模型权重文件。
- **接口**：翻译使用 `POST /chat/completions` 并读取 `choices[0].message.content`；朗读使用 `POST /audio/speech`，接收二进制音频。地址可填基础路径或完整端点。音色默认 `alloy`，不支持该音色时填写服务提供的名称。
- **隐私**：只把点击的原文或译文发给所选服务。远程服务须用 HTTPS，本机回环可用 HTTP；地址从 DSH 宿主解析。设置保存在当前 DSH profile。密钥按宿主 secret 字段保存，不回显给界面；这不是系统钥匙串，请保护 profile 配置文件。更换 API 地址会清除旧密钥，除非同时填写新密钥。

## DSH 插件规范

适配基线为 DSH `0.2.2-rc.5`。`package.json` 声明插件包和客户端入口，`cordis.patch.yml` 将插件加入当前 profile。回复操作使用 `conversation.chat.assistant-actions`，译文显示在当前回合的 `conversation.chat.turnTail`，设置页注册到 `settings.section`。实现入口见 [client/index.jsx](client/index.jsx) 和 [host/index.js](host/index.js)。

## 开发与验证

`npm ci`、`npm run build`、`npm test`。修改 Swift 后在带 macOS 26 SDK 的 Mac 上运行 `npm run build:mac`，再 `npm pack`。测试覆盖真实回环 HTTP、Windows/Linux 无配置分支、宿主设置读写、消息选择和取消竞态。
