# Railway Deployment Guide

## Prerequisites
- Railway account (https://railway.app)
- Railway CLI installed (`npm install -g @railway/cli`)
- Your API keys ready

## Deployment Steps

### 1. Login to Railway
```bash
railway login
```

### 2. Create New Project
```bash
railway init
```
Choose "Empty Project" when prompted.

### 3. Link to GitHub Repository
```bash
railway link
```
Or deploy from GitHub directly in Railway dashboard:
- Go to https://railway.app/new
- Choose "Deploy from GitHub repo"
- Select `sunilbhargava511/Nutritionist`

### 4. Set Environment Variables

Run these commands or set in Railway dashboard:

```bash
# Required API Keys
railway variables set OPENAI_API_KEY=your-openai-key
railway variables set ELEVENLABS_API_KEY=your-11labs-key
railway variables set ELEVENLABS_VOICE_ID=your-voice-id

# Google OAuth
railway variables set GOOGLE_CLIENT_ID=your-google-client-id
railway variables set GOOGLE_CLIENT_SECRET=your-google-client-secret

# Security (generate secure random strings)
railway variables set JWT_SECRET=$(openssl rand -base64 32)
railway variables set SESSION_SECRET=$(openssl rand -base64 32)

# After deployment, update with your Railway URL
railway variables set GOOGLE_CALLBACK_URL=https://your-app.up.railway.app/api/auth/google/callback
railway variables set FRONTEND_URL=https://your-app.up.railway.app
```

### 5. Deploy
```bash
railway up
```

Or if using GitHub integration, it will auto-deploy on push.

### 6. Get Your App URL
```bash
railway open
```

## Post-Deployment Setup

### 1. Update Google OAuth
- Go to Google Cloud Console
- Add your Railway URL to authorized redirect URIs:
  `https://your-app.up.railway.app/api/auth/google/callback`

### 2. Initialize Database
```bash
railway run npm run db:migrate
railway run npm run db:seed  # Optional: adds demo data
```

### 3. Test Your Deployment
- Visit your Railway URL
- Check `/health` endpoint
- Test Google OAuth login

## Environment Variables Checklist

✅ Required:
- [ ] `OPENAI_API_KEY`
- [ ] `ELEVENLABS_API_KEY`
- [ ] `ELEVENLABS_VOICE_ID`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `JWT_SECRET`
- [ ] `SESSION_SECRET`

✅ Auto-configured:
- [ ] `GOOGLE_CALLBACK_URL` (update after deployment)
- [ ] `FRONTEND_URL` (update after deployment)
- [ ] `DATABASE_URL` (Railway provides for PostgreSQL)

## Monitoring

### View Logs
```bash
railway logs
```

### Check Status
```bash
railway status
```

## Troubleshooting

### Database Issues
If using PostgreSQL instead of SQLite:
1. Add PostgreSQL service in Railway
2. Update `DATABASE_URL` will be auto-provided
3. Install pg driver: `npm install pg pg-hstore`

### Build Failures
- Check Node version in `package.json`
- Ensure all dependencies are in `package.json`
- Check build logs: `railway logs`

### OAuth Not Working
- Verify callback URL matches exactly
- Check Google Cloud Console settings
- Ensure environment variables are set

## Custom Domain

To add custom domain:
1. Go to Railway dashboard
2. Settings → Domains
3. Add your domain
4. Update DNS records as instructed

## Scaling

Railway automatically handles:
- SSL certificates
- Auto-scaling
- Zero-downtime deployments
- Rollbacks

## Support

- Railway Discord: https://discord.gg/railway
- Railway Docs: https://docs.railway.app
- GitHub Issues: https://github.com/sunilbhargava511/Nutritionist/issues