/**
 * 笙态AI - Cloudflare Worker 后端代理
 * 
 * 功能：
 * 1. 隐藏 API Key，前端不再暴露敏感信息
 * 2. 统一费率限制（服务端控制）
 * 3. API 调用统计与日志
 * 4. 防止滥用和恶意请求
 * 
 * 部署方式：
 * 1. 注册 Cloudflare (免费)
 * 2. 创建 Worker
 * 3. 粘贴此代码
 * 4. 设置环境变量 API_KEY
 * 5. 绑定自定义域名（可选）
 */

// ===== 配置 =====
const CONFIG = {
  // 通义千问 API 配置
  TONGYI_API_KEY: "", // 在 Cloudflare Worker 环境变量中设置
  TONGYI_ENDPOINT: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  MODEL: "qwen-plus",
  
  // 费率限制配置（服务端）
  RATE_LIMIT: {
    free: {
      daily: 5,        // 每日免费次数
      hourly: 10,      // 每小时限制
      perMinute: 3    // 每分钟限制
    },
    vip: {
      daily: 999,
      hourly: 100,
      perMinute: 20
    }
  },
  
  // 允许的来源（防止盗用）
  ALLOWED_ORIGINS: [
    "https://shengtai.ai",      // 替换为你的域名
    "http://localhost:3000",     // 开发环境
  ],
  
  // 记录统计
  KV_NAMESPACE: null, // 可选：使用 Cloudflare KV 存储统计
};

// ===== 工具函数 =====

// 生成客户端标识符
function getClientId(request) {
  // 优先使用 IP + User-Agent 组合
  const ip = request.headers.get("CF-Connecting-IP") || 
             request.headers.get("X-Forwarded-For") || 
             "unknown";
  const ua = request.headers.get("User-Agent") || "unknown";
  
  // 简单的哈希
  const str = `${ip}-${ua}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `user_${Math.abs(hash).toString(36)}`;
}

// 检查来源是否允许
function isOriginAllowed(origin) {
  if (!origin) return true; // 没有 origin 的请求（如 curl）直接通过
  return CONFIG.ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.endsWith(allowed.replace(/^https?:\/\//, ""))
  );
}

// 获取客户端配额
async function getClientQuota(clientId) {
  const KV = CONFIG.KV_NAMESPACE;
  if (!KV) {
    // 如果没有 KV，使用内存存储（Worker 重启会重置）
    return globalThis[`quota_${clientId}`] || {
      dailyUsed: 0,
      hourlyUsed: 0,
      minutelyUsed: 0,
      totalUsed: 0,
      lastDate: new Date().toDateString(),
      lastHour: new Date().getHours(),
      lastMinute: new Date().getMinutes()
    };
  }
  
  const data = await KV.get(clientId, "json");
  return data || {
    dailyUsed: 0,
    hourlyUsed: 0,
    minutelyUsed: 0,
    totalUsed: 0,
    lastDate: new Date().toDateString(),
    lastHour: new Date().getHours(),
    lastMinute: new Date().getMinutes()
  };
}

// 保存客户端配额
async function saveClientQuota(clientId, quota) {
  const KV = CONFIG.KV_NAMESPACE;
  if (!KV) {
    globalThis[`quota_${clientId}`] = quota;
    return;
  }
  await KV.put(clientId, JSON.stringify(quota), { expirationTtl: 86400 });
}

// 检查费率限制
async function checkRateLimit(clientId) {
  const quota = await getClientQuota(clientId);
  const now = new Date();
  const today = now.toDateString();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const limits = CONFIG.RATE_LIMIT.free;
  
  // 重置每日计数
  if (quota.lastDate !== today) {
    quota.dailyUsed = 0;
    quota.lastDate = today;
  }
  
  // 重置小时计数
  if (quota.lastHour !== currentHour) {
    quota.hourlyUsed = 0;
    quota.lastHour = currentHour;
  }
  
  // 重置分钟计数
  if (quota.lastMinute !== currentMinute) {
    quota.minutelyUsed = 0;
    quota.lastMinute = currentMinute;
  }
  
  // 检查限制
  if (quota.dailyUsed >= limits.daily) {
    return { allowed: false, reason: "daily", message: "今日免费次数已用完" };
  }
  
  if (quota.hourlyUsed >= limits.hourly) {
    return { allowed: false, reason: "hourly", message: "请求太频繁，请稍后再试" };
  }
  
  if (quota.minutelyUsed >= limits.perMinute) {
    return { allowed: false, reason: "minutely", message: "操作太快，请稍等" };
  }
  
  // 更新计数
  quota.dailyUsed++;
  quota.hourlyUsed++;
  quota.minutelyUsed++;
  quota.totalUsed++;
  quota.lastUse = now.toISOString();
  
  await saveClientQuota(clientId, quota);
  
  return { 
    allowed: true, 
    remaining: limits.daily - quota.dailyUsed,
    stats: quota
  };
}

// 记录日志
async function logRequest(clientId, request, response, stats) {
  const log = {
    time: new Date().toISOString(),
    clientId,
    success: response.ok,
    status: response.status,
    stats,
    userAgent: request.headers.get("User-Agent"),
    origin: request.headers.get("Origin")
  };
  
  console.log(JSON.stringify(log));
  
  // 可选：发送到日志服务
  // await fetch("https://your-log-service.com/api/log", {
  //   method: "POST",
  //   body: JSON.stringify(log)
  // });
}

// ===== 主处理函数 =====
async function handleRequest(request) {
  // CORS 预检
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  // 只允许 POST 请求
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "只支持 POST 请求" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 获取客户端标识
  const clientId = getClientId(request);
  
  // 检查费率限制
  const limitCheck = await checkRateLimit(clientId);
  
  if (!limitCheck.allowed) {
    return new Response(JSON.stringify({
      error: limitCheck.message,
      code: "RATE_LIMIT_EXCEEDED",
      reason: limitCheck.reason
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": "0",
        "Retry-After": "60"
      }
    });
  }

  try {
    // 解析请求体
    const body = await request.json();
    
    // 验证请求
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: "无效的请求格式" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 限制消息长度
    if (body.messages.length > 20) {
      body.messages = body.messages.slice(-20);
    }

    // 调用通义千问 API
    const apiResponse = await fetch(CONFIG.TONGYI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.TONGYI_API_KEY}`
      },
      body: JSON.stringify({
        model: CONFIG.MODEL,
        messages: body.messages,
        temperature: body.temperature || 0.7,
        max_tokens: body.max_tokens || 2000
      })
    });

    // 记录请求
    await logRequest(clientId, request, apiResponse, limitCheck.stats);

    // 返回响应
    const data = await apiResponse.json();
    
    return new Response(JSON.stringify(data), {
      status: apiResponse.status,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": limitCheck.remaining.toString(),
        "X-Client-Id": clientId
      }
    });

  } catch (error) {
    console.error("Proxy Error:", error);
    
    return new Response(JSON.stringify({
      error: "服务暂不可用",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ===== Cloudflare Worker 入口 =====
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});
