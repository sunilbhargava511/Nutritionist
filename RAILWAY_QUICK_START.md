# 🚂 Railway Quick Start Guide

Deploy NutritionAssist to Railway in 5 minutes!

## Prerequisites
- GitHub account
- [Railway account](https://railway.app) (free)
- [Anthropic API key](https://console.anthropic.com)

## Quick Deploy Steps

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - NutritionAssist"
git remote add origin https://github.com/YOUR_USERNAME/nutritionist-app.git
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Empty Project"** (or "Deploy from GitHub repo")
4. Inside the project, click **"+ New"** → **"GitHub Repo"**
5. Select **"Configure GitHub App"** if first time
6. Choose `sunilbhargava511/Nutritionist` repository
7. Railway auto-detects Next.js app and creates a service

### 3. Set Environment Variables

In Railway dashboard → Variables tab, add:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-api-YOUR_KEY_HERE
DATABASE_URL=file:./database.sqlite
NODE_ENV=production

# Optional (for voice features)
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
ELEVENLABS_WEBHOOK_SECRET=your_secret
```

### 4. Deploy!

Railway automatically:
- Builds your app
- Deploys it
- Provides a URL: `https://your-app.railway.app`

## 🎉 That's it!

Your NutritionAssist app is now live!

## Optional Enhancements

### Add PostgreSQL Database
1. Click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway auto-configures `DATABASE_URL`

### Custom Domain
1. Go to **Settings** → **Domains**
2. Add your domain
3. Update DNS records

### Monitor & Scale
- View logs: `railway logs`
- Check metrics in dashboard
- Auto-scaling configured

## Need Help?
- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- Open an issue in this repo