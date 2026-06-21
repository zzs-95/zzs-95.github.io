# 🚀 笙态AI - 部署指南

## 📋 部署流程

```
第一步：创建 Firebase 项目（免费）
    ↓
第二步：配置 Firebase（认证 + 数据库）
    ↓
第三步：替换网站中的 Firebase 配置
    ↓
第四步：上传到 Netlify（免费托管）
    ↓
完成！你的 AI 网站上线啦！🎉
```

---

## 第一步：创建 Firebase 项目

### 1. 注册 Firebase

1. 访问 👉 **[console.firebase.google.com](https://console.firebase.google.com)**
2. 点击 **"添加项目"**
3. 项目名称填：`shengtai-ai`（或你喜欢的名字）
4. 关闭 Google Analytics（可选，个人项目不需要）
5. 点击 **"创建项目"**

### 2. 获取项目配置

创建完成后，你会进入项目控制台：

1. 点击左侧 **⚙️ 项目设置**（齿轮图标）
2. 滚动到 **"你的应用"** 部分
3. 点击 **Web** 图标 `</>` 
4. 输入应用昵称：`shengtai-ai-web`
5. **不要**勾选 Firebase Hosting
6. 点击 **"注册应用"**

你会看到这样的配置代码：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "shengtai-ai.firebaseapp.com",
  projectId: "shengtai-ai",
  storageBucket: "shengtai-ai.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456ghi789"
};
```

**把这些信息复制下来，后面要用！**

---

## 第二步：配置 Firebase

### 1. 开启邮箱登录

1. 左侧菜单 → **Authentication**（身份验证）
2. 点击 **"开始"**
3. 点击 **"邮箱/密码"**
4. 启用 **"邮箱/密码"**
5. 点击 **"保存"**

### 2. 开启 Google 登录（可选）

1. 在同一页面找到 **"Google"**
2. 启用它
3. 选择一个公开的开发者邮箱（可以是你的 Gmail）
4. 点击 **"保存"**

### 3. 创建 Firestore 数据库

1. 左侧菜单 → **Firestore Database**
2. 点击 **"创建数据库"**
3. 选择 **"测试模式"**（开发阶段够用）
4. 选择最近的位置（如 `asia-east1` 或 `asia-northeast1`）
5. 点击 **"启用"**

### 4. 设置数据库规则（重要！）

为了让用户只能访问自己的数据：

1. 进入 Firestore → **规则**
2. 删除原有规则，粘贴以下内容：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 用户只能访问自己的数据
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // 用户只能访问自己的对话记录
      match /chats/{chatId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

3. 点击 **"发布"**

---

## 第三步：替换网站中的 Firebase 配置

找到以下文件，替换 `YOUR_API_KEY` 等占位符为你在第一步获取的真实配置：

### 需要修改的文件：

| 文件 | 要替换的内容 |
|------|-------------|
| `login.html` | Firebase 配置（大约第170行） |
| `chat.html` | Firebase 配置（大约第280行） |

### 具体操作：

在每个文件中找到：

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

替换为你在 Firebase 控制台获取的真实配置：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "shengtai-ai.firebaseapp.com",
  projectId: "shengtai-ai",
  storageBucket: "shengtai-ai.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123def456ghi789"
};
```

---

## 第四步：部署到 Netlify

### 方式一：拖拽上传（最简单）

1. 打开 👉 **[app.netlify.com/drop](https://app.netlify.com/drop)**
2. **如果你还没注册 Netlify**，点击 "Sign up" 用 GitHub/邮箱注册
3. 把 `ai-consultant` 文件夹**整个拖进去**
4. 等待几秒，你会获得一个随机域名，例如：
   ```
   https://random-name-12345.netlify.app
   ```
5. 点击链接测试你的网站！

### 方式二：通过 GitHub 上传（推荐长期使用）

1. **创建 GitHub 仓库**：
   - 打开 👉 **[github.com/new](https://github.com/new)**
   - 仓库名称：`shengtai-ai`
   - 选择 **Public**（公开）
   - 勾选 **"Add a README file"**
   - 点击 **"Create repository"**

2. **上传网站文件**：
   - 在新创建的仓库页面，点击 **"uploading an existing file"**
   - 把 `ai-consultant` 文件夹里的**所有文件**拖进去
   - 点击 **"Commit changes"**

3. **连接到 Netlify**：
   - 打开 👉 **[app.netlify.com](https://app.netlify.com)**
   - 点击 **"Add new site"** → **"Import an existing project"**
   - 选择 **GitHub**
   - 授权 Netlify 访问你的 GitHub
   - 选择 `shengtai-ai` 仓库
   - 构建设置留空（静态网站不需要构建）
   - 点击 **"Deploy site"**

4. **等待部署完成**，获得 Netlify 域名！

---

## 🎉 恭喜！你已经完成了！

现在你可以：

1. ✅ 用邮箱/Google 登录
2. ✅ 对话历史自动保存
3. ✅ VIP 会员系统（界面已做好，支付待接入）
4. ✅ 免费托管在 Netlify

---

## 📊 功能说明

| 功能 | 状态 | 说明 |
|------|------|------|
| 邮箱登录 | ✅ 可用 | Firebase Auth |
| Google 登录 | ✅ 可用 | Firebase Auth |
| 对话历史 | ✅ 可用 | Firestore 数据库 |
| VIP 会员 | ⚠️ 界面完成 | 支付待接入 |
| AI 对话 | ✅ 可用 | 通义千问 API |

---

## ⚠️ 注意事项

### Firebase 免费额度

| 项目 | 免费额度 | 超出后 |
|------|---------|--------|
| 认证用户 | 无限 | - |
| Firestore 存储 | 1GB | $0.18/GB |
| Firestore 读取 | 5万/天 | $0.036/万次 |
| Firestore 写入 | 2万/天 | $0.018/万次 |

**个人项目：完全够用！**

### API Key 安全

当前通义千问 API Key 还在前端代码中。如果要完全保护：
1. 使用 Cloudflare Worker 作为代理（之前创建的 proxy 文件）
2. 或使用 Firebase Cloud Functions 调用 API

---

## ❓ 遇到问题？

常见问题：

**Q: 登录失败？**
A: 检查 Firebase Authentication 是否开启了邮箱登录

**Q: 对话保存失败？**
A: 检查 Firestore 数据库规则是否正确

**Q: AI 不回复？**
A: 检查通义千问 API Key 是否有效

---

*祝你的 AI 网站大获成功！🚀*
