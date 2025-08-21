# Deployment Guide - NutritionAssist Learning Platform

## 🚀 Quick Deployment to Railway

Railway provides a simple, modern platform for deploying Next.js applications with automatic builds and deployments.

### Prerequisites
- GitHub account with repository access
- Railway account (sign up at [railway.app](https://railway.app))
- Anthropic API key from [Anthropic Console](https://console.anthropic.com)
- (Optional) ElevenLabs API key for voice features

### Step 1: Deploy to Railway

#### Option A: Deploy via GitHub (Recommended)

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/nutritionist-app.git
   git push -u origin main
   ```

2. **Create Railway Project & Service**
   - Go to [railway.app](https://railway.app)
   - Click "New Project"
   - Choose "Empty Project" to start fresh
   - Inside the project, click "+ New" button
   - Select "GitHub Repo" to create a service
   - Connect your GitHub account if needed
   - Choose `sunilbhargava511/Nutritionist` repository
   - Railway will automatically detect the Next.js app and create a service

3. **Configure Environment Variables**
   - Click on your service (it will have your repo name)
   - Go to the "Variables" tab
   - Add the following required variables:
     ```
     ANTHROPIC_API_KEY=sk-ant-api...
     DATABASE_URL=file:./database.sqlite
     NODE_ENV=production
     ```
   - Add optional variables for voice features:
     ```
     NEXT_PUBLIC_ELEVENLABS_API_KEY=your_key
     ELEVENLABS_API_KEY=your_key
     ELEVENLABS_WEBHOOK_SECRET=your_secret
     ```

4. **Deploy**
   - Railway will automatically build and deploy your app
   - Your app will be available at `https://your-app.railway.app`

#### Option B: Deploy via Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize project**
   ```bash
   railway init
   ```

4. **Link to GitHub (optional)**
   ```bash
   railway link
   ```

5. **Add environment variables**
   ```bash
   railway variables set ANTHROPIC_API_KEY=sk-ant-api...
   railway variables set DATABASE_URL=file:./database.sqlite
   railway variables set NODE_ENV=production
   ```

6. **Deploy**
   ```bash
   railway up
   ```

### Step 2: Configure Database

The app uses SQLite by default, which works well for Railway. For production use with multiple instances, consider upgrading to PostgreSQL:

1. **Add PostgreSQL Service to Railway**
   - In your Railway project dashboard, click "+ New"
   - Select "Database" → "Add PostgreSQL"
   - Railway will create a new PostgreSQL service
   - The database service will appear alongside your app service

2. **Update DATABASE_URL**
   - Railway automatically sets the `DATABASE_URL` variable
   - The app will automatically use PostgreSQL when available

### Step 3: Set Up Custom Domain (Optional)

1. **Add custom domain in Railway**
   - Go to Settings → Domains
   - Click "Add Domain"
   - Enter your domain name

2. **Configure DNS**
   - Add a CNAME record pointing to your Railway domain
   - Or use Railway's provided domain

### Step 4: Configure Voice Features (Optional)

If using ElevenLabs for voice:

1. **Get ElevenLabs API credentials**
   - Sign up at [elevenlabs.io](https://elevenlabs.io)
   - Get your API key from the dashboard

2. **Set up webhooks**
   - In ElevenLabs dashboard, set webhook URL to:
     ```
     https://your-app.railway.app/api/elevenlabs-webhook
     ```

3. **Add environment variables**
   ```bash
   railway variables set NEXT_PUBLIC_ELEVENLABS_API_KEY=your_key
   railway variables set ELEVENLABS_API_KEY=your_key
   railway variables set ELEVENLABS_WEBHOOK_SECRET=your_secret
   ```

## 🔧 Configuration Files

### railway.json
The `railway.json` file configures the build and deployment:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/api/health"
  }
}
```

### nixpacks.toml
The `nixpacks.toml` file specifies the build environment:
```toml
[phases.setup]
nixPkgs = ["nodejs_18", "npm"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm run start"
```

## 🔒 Security Considerations

1. **Environment Variables**
   - Never commit `.env` files to Git
   - Use Railway's environment variables for all secrets
   - Rotate API keys regularly

2. **Database Security**
   - Use PostgreSQL for production
   - Enable SSL for database connections
   - Regular backups via Railway dashboard

3. **API Keys**
   - Use separate API keys for development and production
   - Monitor usage in Anthropic/ElevenLabs dashboards
   - Set up billing alerts

## 📊 Monitoring

1. **Railway Dashboard**
   - Monitor deployments in real-time
   - View logs: `railway logs`
   - Check metrics and resource usage

2. **Application Health**
   - Health check endpoint: `/api/health`
   - Monitor response times and errors
   - Set up alerts for failures

## 🚨 Troubleshooting

### Build Failures
```bash
# Check build logs
railway logs --build

# Verify Node version
railway variables set NODE_VERSION=18
```

### Database Issues
```bash
# Reset database
railway run npm run db:migrate

# Check database connection
railway run npm run db:studio
```

### Environment Variables
```bash
# List all variables
railway variables

# Set a variable
railway variables set KEY=value

# Remove a variable
railway variables remove KEY
```

## 📝 Maintenance

### Updates
```bash
# Deploy updates
git push origin main
# Railway auto-deploys on push

# Or manually via CLI
railway up
```

### Scaling
- Railway automatically handles scaling
- Configure in Settings → Scaling
- Set min/max instances as needed

### Backups
- Database backups available in Railway dashboard
- Download via PostgreSQL dashboard
- Set up automated backups in settings

## 🔗 Useful Links

- [Railway Documentation](https://docs.railway.app)
- [Railway CLI Reference](https://docs.railway.app/develop/cli)
- [Next.js on Railway](https://docs.railway.app/guides/nextjs)
- [Railway Templates](https://railway.app/templates)
- [Railway Discord](https://discord.gg/railway)

## 💡 Tips

1. Use Railway's preview deployments for testing
2. Enable automatic deployments from GitHub
3. Set up deployment notifications in Discord/Slack
4. Use Railway's built-in PostgreSQL for production
5. Monitor costs in the billing dashboard

Need help? Check the [Railway Discord](https://discord.gg/railway) or open an issue in the repository.