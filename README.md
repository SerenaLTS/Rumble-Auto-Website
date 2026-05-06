# RUMBLE Auto Website

Sydney NSW SITRAK truck sales, service support and fleet pathways from Arndell Park.

## 📁 项目结构

```
.
├── index.html                 # 主页
├── models.html               # 车型页面
├── services.html             # 服务页面
├── fleet-finance.html        # 融资页面
├── [model]-series.html       # 各车系详情页
├── [model]-spec.html         # 各车型规格页
├── styles.css                # 全局样式
├── script.js                 # 交互脚本
├── config.js                 # CDN配置 ⭐
├── .gitignore               # Git忽略规则
├── assets/                   # 资源文件夹（不上传大文件）
│   ├── models/              # 模型AVIF图像
│   ├── videos/              # 视频（Cloudflare CDN）
│   └── brochures/           # PDF手册（Cloudflare CDN）
└── README.md                # 本文件
```

## 🌐 CDN 配置说明

### 关键特性

- **本地开发**: 使用本地 `/assets` 文件夹
- **生产环境**: 自动指向Cloudflare CDN
- **智能切换**: 根据域名自动判断环境

### 配置 `config.js`

在部署到生产环境前，修改 `config.js` 中的CDN地址：

```javascript
CDN_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/assets' // 本地开发
  : 'https://your-cloudflare-cdn.com/assets', // ✏️ 改为你的Cloudflare URL
```

### 如何获取Cloudflare URL

1. 登录Cloudflare Dashboard
2. 选择你的域名
3. 在 Pages/Workers 中找到资源URL
4. 格式通常为: `https://cdn.yourdomain.com/assets`

## 📦 .gitignore 规则

以下文件**不上传**到GitHub（存储在Cloudflare）：

```
# 大型图像
*.png, *.jpg, *.jpeg

# 视频
*.mp4, *.avi, *.mov, *.mkv, *.webm

# PDF手册
assets/brochures/*.pdf
```

## 🚀 上传到GitHub

### 第1步：初始化Git

```bash
cd /Users/serena/Desktop/Rumble_PC
git init
git config user.name "你的名字"
git config user.email "你的邮箱"
```

### 第2步：添加remote

```bash
git remote add origin https://github.com/SerenaLTS/Rumble-Auto-Website.git
```

### 第3步：添加文件并提交

```bash
git add .
git status  # 检查要上传的文件（应排除所有大文件）
git commit -m "Initial commit: Rumble Auto website with CDN config"
```

### 第4步：推送到GitHub

```bash
git branch -M main
git push -u origin main
```

### 验证上传成功

```bash
git log --oneline  # 查看提交历史
git remote -v      # 确认remote配置
```

## 🔄 更新流程

开发新功能：

```bash
# 新增或修改文件
git add .
git commit -m "描述你的改动"
git push origin main
```

## ⚡ 部署到生产环境

### 使用GitHub Pages

1. 在 Settings → Pages 中启用Pages
2. 选择 `main` 分支作为源
3. 添加 `CNAME` 文件指向你的域名
4. 在DNS中配置CNAME记录

### 使用自己的服务器

1. Clone仓库到服务器
2. 配置 `config.js` 中的Cloudflare URL
3. 配置DNS指向服务器IP

## ✅ 检查清单

- [ ] 修改 `config.js` 中的Cloudflare URL
- [ ] 验证 `.gitignore` 排除了所有大文件
- [ ] 在本地运行测试（开发环境）
- [ ] 上传到GitHub
- [ ] 在生产环境中配置DNS
- [ ] 验证所有资源从Cloudflare正常加载

## 📞 支持

有问题？检查以下内容：

1. **图片不显示**: 检查Cloudflare URL是否正确配置
2. **推送失败**: 确认remote URL正确 (`git remote -v`)
3. **文件太大**: 确保大文件在.gitignore中被排除

---

**最后更新**: 2026-05-06
