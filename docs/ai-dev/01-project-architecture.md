# 插件结构

`client/index.jsx` 注册 `conversation.chat.assistant-actions`、`conversation.chat.turnTail` 和 `settings.section`。`client/reader.js` 只查被点击的消息，控制当前播放和每条译文；不订阅或上传全文。`host/index.js` 通过 DSH 的 owner-only `connection.fetch.register` 提供设置和处理端点，volatile Config 经 `settings.mutate` 写回 profile。`host/providers.js` 只调用用户选择的后端。原文和译文不写入宿主会话。
