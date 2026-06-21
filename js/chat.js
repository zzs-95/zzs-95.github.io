// ===== 通义千问 API 配置 =====
const API_CONFIG = {
  apiKey: "sk-ws-H.RPEMPMH.IJ6u.MEUCIEf6ls3xUkzP4vrmY5mm79BanDu0UFDMHwbvL7HsYDZTAiEAuep_7K5PH5rnCUe3_bTkjJcWMk54Q87Oya3dHW--qPI",
  endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  model: "qwen-plus"
};

// ===== 费率限制配置 =====
const RATE_LIMITS = {
  free: {
    daily: 5,           // 每日免费次数
    hourly: 10,         // 每小时限制
    perMinute: 3        // 每分钟限制（防刷）
  },
  vip: {
    daily: 999,
    hourly: 100,
    perMinute: 10
  }
};

// ===== 监控统计 =====
const USAGE_STATS = {
  key: "shengtai_usage_v2",
  get: function() {
    const data = localStorage.getItem(this.key);
    if (!data) return this.init();
    const stats = JSON.parse(data);
    // 检查是否新的一天，重置每日配额
    const today = new Date().toDateString();
    if (stats.lastDate !== today) {
      stats.dailyUsed = 0;
      stats.lastDate = today;
      this.save(stats);
    }
    return stats;
  },
  init: function() {
    const stats = {
      dailyUsed: 0,
      hourlyUsed: 0,
      minutelyUsed: 0,
      totalUsed: 0,
      lastDate: new Date().toDateString(),
      lastHour: new Date().getHours(),
      lastMinute: new Date().getMinutes(),
      firstUse: null,
      lastUse: null
    };
    this.save(stats);
    return stats;
  },
  save: function(stats) {
    localStorage.setItem(this.key, JSON.stringify(stats));
  },
  record: function() {
    const stats = this.get();
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    stats.totalUsed++;

    // 重置小时计数
    if (stats.lastHour !== currentHour) {
      stats.hourlyUsed = 0;
      stats.lastHour = currentHour;
    }

    // 重置分钟计数
    if (stats.lastMinute !== currentMinute) {
      stats.minutelyUsed = 0;
      stats.lastMinute = currentMinute;
    }

    stats.dailyUsed++;
    stats.hourlyUsed++;
    stats.minutelyUsed++;
    stats.lastUse = now.toISOString();

    if (!stats.firstUse) stats.firstUse = now.toISOString();

    this.save(stats);
    this.updateDisplay();
    return stats;
  },
  check: function(isVip = false) {
    const stats = this.get();
    const limits = isVip ? RATE_LIMITS.vip : RATE_LIMITS.free;
    const now = new Date();
    const currentMinute = now.getMinutes();

    // 检查每日限制
    if (stats.dailyUsed >= limits.daily) {
      return {
        allowed: false,
        reason: "daily",
        message: `今日免费次数已用完！请升级会员获取无限提问。`,
        remaining: 0
      };
    }

    // 检查小时限制
    if (stats.lastHour !== now.getHours()) {
      stats.hourlyUsed = 0;
    }
    if (stats.hourlyUsed >= limits.hourly) {
      return {
        allowed: false,
        reason: "hourly",
        message: "请求太频繁，请稍后再试。",
        remaining: 0
      };
    }

    // 检查分钟限制（防刷）
    if (stats.lastMinute !== currentMinute) {
      stats.minutelyUsed = 0;
    }
    if (stats.minutelyUsed >= limits.perMinute) {
      return {
        allowed: false,
        reason: "minutely",
        message: "操作太快了，请稍等几秒...",
        remaining: 0
      };
    }

    return {
      allowed: true,
      remaining: limits.daily - stats.dailyUsed
    };
  },
  updateDisplay: function() {
    const stats = this.get();
    const remaining = RATE_LIMITS.free.daily - stats.dailyUsed;

    // 更新侧边栏显示
    const freeTierEl = document.querySelector(".free-tier");
    if (freeTierEl) {
      freeTierEl.innerHTML = `今日剩余 <strong style="color:#8b5cf6">${remaining}</strong> 次提问`;
    }

    // 更新聊天框内显示
    const remainingEl = document.getElementById("remainingCount");
    if (remainingEl) {
      remainingEl.textContent = remaining;
    }

    // 更新底部统计
    this.updateStatsPanel(stats);
  },
  updateStatsPanel: function(stats) {
    const panel = document.getElementById("usageStats");
    if (!panel) return;

    const remaining = RATE_LIMITS.free.daily - stats.dailyUsed;
    panel.innerHTML = `
      <div class="stats-item">
        <span class="stats-label">今日已用</span>
        <span class="stats-value">${stats.dailyUsed} / ${RATE_LIMITS.free.daily}</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">本月累计</span>
        <span class="stats-value">${stats.totalUsed} 次</span>
      </div>
      <div class="stats-item">
        <span class="stats-label">请求限制</span>
        <span class="stats-value">${RATE_LIMITS.free.perMinute}/分钟</span>
      </div>
    `;
  }
};

// ===== AI Chat with 通义千问 =====

let remainingFree = 5;
let isTyping = false;
let conversationHistory = [];

// 调用通义千问 API
async function callTongyiAPI(messages) {
  try {
    const response = await fetch(API_CONFIG.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    const data = await response.json();

    // 记录成功的API调用
    USAGE_STATS.record();

    return data.choices[0].message.content;
  } catch (error) {
    console.error("API调用错误:", error);
    throw error;
  }
}

// Add message to chat
function addMessage(content, isUser = false) {
  const messagesContainer = document.getElementById("chatMessages");
  const suggestions = document.getElementById("suggestions");

  if (isUser) {
    suggestions.style.display = "none";
  }

  const messageDiv = document.createElement("div");
  messageDiv.className = isUser ? "message user-message" : "message ai-message";

  const bubbleContent = isUser ? content : content.replace(/\n/g, "<br>");

  messageDiv.innerHTML = `
    <div class="message-avatar">${isUser ? "👤" : "💫"}</div>
    <div class="message-content">
      <div class="message-bubble">${bubbleContent}</div>
      <div class="message-time">${isUser ? "" : "刚刚"}</div>
    </div>
  `;

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show typing indicator
function showTyping() {
  const messagesContainer = document.getElementById("chatMessages");
  const typingDiv = document.createElement("div");
  typingDiv.className = "message ai-message";
  typingDiv.id = "typingIndicator";
  typingDiv.innerHTML = `
    <div class="message-avatar">💫</div>
    <div class="message-content">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Remove typing indicator
function hideTyping() {
  const typing = document.getElementById("typingIndicator");
  if (typing) typing.remove();
}

// Send message
async function sendMessage() {
  if (isTyping) return;

  const input = document.getElementById("userInput");
  const message = input.value.trim();

  if (!message) return;

  // 检查费率限制
  const limitCheck = USAGE_STATS.check(false);
  if (!limitCheck.allowed) {
    addMessage(`⏰ ${limitCheck.message}`, false);
    return;
  }

  // Add user message
  addMessage(message, true);
  input.value = "";

  // Add to conversation history
  conversationHistory.push({
    role: "user",
    content: message
  });

  // Show typing indicator
  isTyping = true;
  showTyping();

  try {
    const aiResponse = await callTongyiAPI(conversationHistory);

    hideTyping();
    addMessage(aiResponse, false);

    conversationHistory.push({
      role: "assistant",
      content: aiResponse
    });

    saveChatHistory(message, aiResponse);
  } catch (error) {
    hideTyping();
    addMessage("😔 抱歉，服务暂时出了点问题，请稍后再试。或者你可以联系客服：2373502209@qq.com", false);
    console.error("Error:", error);
  }

  isTyping = false;
}

// Send suggestion
function sendSuggestion(btn) {
  const suggestion = btn.textContent;
  document.getElementById("userInput").value = suggestion;
  sendMessage();
}

// Auto resize textarea
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}

// Handle Enter key
document.getElementById("userInput").addEventListener("keypress", function(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// New chat
function newChat() {
  document.getElementById("chatMessages").innerHTML = `
    <div class="message ai-message">
      <div class="message-avatar">💫</div>
      <div class="message-content">
        <div class="message-bubble">
          <p>👋 你好！我是<strong>笙态</strong>的AI助手，基于通义千问驱动。</p>
          <p style="margin-top:12px">请随时告诉我你的问题或需求，我会尽力帮助你！😊</p>
        </div>
        <div class="message-time">刚刚</div>
      </div>
    </div>
  `;
  document.getElementById("suggestions").style.display = "block";
  remainingFree = 5;
  document.getElementById("remainingCount").textContent = remainingFree;
  conversationHistory = [
    {
      role: "system",
      content: "你是一个友好的AI助手，名字叫笙态。你的职责是帮助用户解答各种问题，包括旅行规划、职场建议、育儿知识、学习辅导等。回答要友好、专业、有帮助。"
    }
  ];
}

// Clear chat
function clearChat() {
  if (confirm("确定要清空当前对话吗？")) {
    newChat();
  }
}

// Save chat history
function saveChatHistory(userMsg, aiMsg) {
  let history = JSON.parse(localStorage.getItem("shengtai_chat") || "[]");
  history.push({
    user: userMsg,
    ai: aiMsg,
    time: new Date().toISOString()
  });
  if (history.length > 20) history = history.slice(-20);
  localStorage.setItem("shengtai_chat", JSON.stringify(history));
}

// Initialize
document.addEventListener("DOMContentLoaded", function() {
  // 初始化统计数据显示
  USAGE_STATS.updateDisplay();

  // 初始化对话历史
  conversationHistory = [
    {
      role: "system",
      content: "你是一个友好的AI助手，名字叫笙态。你的职责是帮助用户解答各种问题，包括旅行规划、职场建议、育儿知识、学习辅导等。回答要友好、专业、有帮助。"
    }
  ];
});
