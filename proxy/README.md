# 🚀 笙态AI - 后端代理部署指南

## 为什么需要后端代理？

```
❌ 当前架构（不安全）
┌─────────┐      API Key暴露      ┌──────────────┐
│  浏览器  │ ──────────────────→  │  通义千问API  │
└─────────┘   sk-ws-xxx...        └──────────────┘
             ❌ 任何人都可以查看源码获取Key
             ❌ 容易被盗刷

✅ 使用代理后（安全）
┌─────────┐                      ┌─────────────┐     API Key隐藏      ┌──────────────┐
│  浏览器  │ ──── 无Key请求 ────→ │ Cloudflare  │ ─────────────────→  │  通义千问API  │
└─────────┘                      │   Worker    │                       └──────────────┘
                                  └─────────────┘
                                     ✅ Key只在服务端
                                     ✅ 服务端限流
                                     ✅ 防DDoS
```

---

## 📦 部署 Cloudflare Worker

### 第一步：注册 Cloudflare

1. 访问 [cloudflare.com](https://cloudflare.com)
2. 注册账号（免费）
3. 验证邮箱

### 第二步：创建 Worker

1. 登录 Cloudflare Dashboard
2. 进入 **Workers & Pages**
3. 点击 **Create Application**
4. 选择 **Create Worker**
5. 命名：`shengtai-ai-proxy`（或其他名字）

### 第三步：配置 Worker

1. 点击 **Edit Code**
2. 删除默认代码
3. 粘贴 `worker.js` 的全部内容

### 第四步：设置环境变量

1. 在 Worker 设置中找到 **Settings** → **Variables**
2. 添加环境变量：
   - **Name**: `API_KEY`
   - **Value**: 你的通义千问 API Key（`sk-ws-H.RPEMPMH...`）
3. 点击 **Save and Deploy**

### 第五步：获取 API 地址

部署成功后，你会获得一个类似这样的地址：
```
https://shengtai-ai-proxy.your-subdomain.workers.dev
```

---

## 🔧 修改前端代码

在 `chat.js` 中，把：

```javascript
const API_CONFIG = {
  apiKey: "sk-ws-xxx...",  // 删除这行！
  endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  // ...
};
```

改为：

```javascript
const API_CONFIG = {
  // 使用代理地址，不需要 API Key
  endpoint: "https://shengtai-ai-proxy.your-subdomain.workers.dev/chat",
  // ...
};
```

---

## 📊 功能特性

| 功能 | 说明 |
|------|------|
| 🔒 **API Key 隐藏** | Key 只存在于服务端，前端代码无 Key |
| ⏱️ **服务端限流** | 防止恶意刷接口 |
| 📈 **调用统计** | 记录每次请求（可扩展到 KV 存储） |
| 🌐 **全球加速** | Cloudflare 全球 CDN |
| 🛡️ **防 DDoS** | Cloudflare 防护 |
| 📝 **详细日志** | 每次请求都有记录 |

---

## 💰 费用

| 项目 | 免费额度 |
|------|----------|
| Cloudflare Workers | 100,000 请求/天 |
| Cloudflare KV | 1GB 存储 |
| 带宽 | 10GB/月 |

对于个人项目或小型创业项目，**完全免费够用**！

---

## 🔐 安全建议

### 1. 限制来源（推荐）

在 `worker.js` 中修改：
```javascript
const CONFIG = {
  ALLOWED_ORIGINS: [
    "https://your-domain.com",      // 你的网站域名
    "https://www.your-domain.com",  // www 版本
  ],
  // ...
};
```

### 2. 添加 API Key（可选）

如果你想给用户分配独立的访问 Key：
```javascript
// 在请求头中传递用户Key
headers: {
  "X-User-Key": "user-api-key"
}
```

### 3. 监控告警

在 Cloudflare Dashboard 设置：
- 请求量异常告警
- 错误率监控
- KV 存储使用量

---

## 📞 需要帮助？

- Cloudflare 文档: https://developers.cloudflare.com/workers/
- 通义千问 API: https://help.aliyun.com/zh/dashscope/

---

*Made with ❤️ by 笙态AI*
