# Environment Variables Setup Guide

## 🚨 Critical Security Fix

The initial `.env.example` had **WRONG** environment variable names that would expose API keys to the client. This has been corrected.

## ✅ Correct Environment Variables

### Required Variables (Copy to `.env.local`):

```bash
# ElevenLabs Configuration (Server-side ONLY)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_AGENT_ID=your_agent_id_here  
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here

# Claude AI Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🔒 Security Notes

### ❌ **NEVER DO THIS** (Security Risk):
```bash
# WRONG - These expose API keys to the browser!
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_key  # ❌ EXPOSED TO CLIENT
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_id  # ❌ EXPOSED TO CLIENT
```

### ✅ **CORRECT** (Secure):
```bash
# RIGHT - These stay on the server
ELEVENLABS_API_KEY=your_key              # ✅ SERVER-SIDE ONLY
ELEVENLABS_AGENT_ID=your_id              # ✅ SERVER-SIDE ONLY
```

## 📋 Setup Steps

### 1. Create Environment File
```bash
# Copy the template
cp .env.local.template .env.local
```

### 2. Get ElevenLabs Credentials

1. **API Key**: 
   - Go to [ElevenLabs Dashboard](https://elevenlabs.io/app/voice-lab)
   - Navigate to Settings → API Keys
   - Copy your API key

2. **Agent ID**:
   - Go to Conversational AI → Agents
   - Create or select your agent
   - Copy the Agent ID from the URL or settings

3. **Webhook Secret**:
   - In your agent settings
   - Go to Webhooks section
   - Copy the webhook secret provided

### 3. Get Anthropic API Key
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create API key
3. Copy the key

### 4. Update .env.local
```bash
# Replace with your actual values
ELEVENLABS_API_KEY=sk_your_actual_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_actual_agent_id  
ELEVENLABS_WEBHOOK_SECRET=your_actual_webhook_secret
ANTHROPIC_API_KEY=sk-ant-your_actual_anthropic_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## ✅ Verification

### Test API Keys Work:
```bash
# Start development server
npm run dev

# Test signed URL endpoint
curl -X POST http://localhost:3000/api/elevenlabs-signed-url

# Should return JSON with signedUrl (not an error)
```

### Common Issues:

1. **"API key not configured"**
   - Check `.env.local` exists in project root
   - Verify variable names are correct (no `NEXT_PUBLIC_` for API keys)
   - Restart development server after adding keys

2. **"Agent not found"**  
   - Verify `ELEVENLABS_AGENT_ID` is correct
   - Ensure agent is published in ElevenLabs console

3. **"Webhook signature failed"**
   - Check `ELEVENLABS_WEBHOOK_SECRET` matches console
   - Ensure webhook URL is configured correctly

## 🚀 Production Deployment

### For Vercel/Production:

1. **Set Environment Variables in Dashboard**:
   ```bash
   ELEVENLABS_API_KEY=your_production_key
   ELEVENLABS_AGENT_ID=your_agent_id
   ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret  
   ANTHROPIC_API_KEY=your_anthropic_key
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

2. **Update ElevenLabs Agent Webhook URL**:
   - Change from `http://localhost:3000/api/elevenlabs-webhook`
   - To `https://your-domain.com/api/elevenlabs-webhook`

## 📝 Summary

**Required in `.env.local`:**
- ✅ `ELEVENLABS_API_KEY` (server-side)
- ✅ `ELEVENLABS_AGENT_ID` (server-side) 
- ✅ `ELEVENLABS_WEBHOOK_SECRET` (server-side)
- ✅ `ANTHROPIC_API_KEY` (server-side)
- ✅ `NEXT_PUBLIC_APP_URL` (client-safe)

**Security Rule:**
- 🔒 **API Keys = Server-side only** (no `NEXT_PUBLIC_`)
- 🌐 **URLs/IDs = Client-safe** (can use `NEXT_PUBLIC_`)

Your `.env.local` is now properly configured for secure ElevenLabs integration!