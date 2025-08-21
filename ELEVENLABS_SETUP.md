# ElevenLabs Conversational AI Setup Guide

This guide will help you configure the ElevenLabs Conversational AI agent for the Financial Advisor application.

## Prerequisites

1. ElevenLabs account with Conversational AI access
2. Sanjay's voice cloned in ElevenLabs (Voice ID: `MXGyTMlsvQgQ4BL0emIa`)
3. API keys configured in your environment

## Step 1: Create ElevenLabs Agent

1. **Login to ElevenLabs Console**
   - Go to [ElevenLabs Console](https://console.elevenlabs.io)
   - Navigate to "Conversational AI" → "Agents"

2. **Create New Agent**
   - Click "Create Agent"
   - Name: "Sanjay Bhargava - Financial Advisor"
   - Description: "AI version of PayPal founding member Sanjay Bhargava offering financial guidance"

3. **Configure Agent Personality**
   Use the configuration from `agents/sanjay-bhargava.json`:

   ```json
   {
     "name": "Sanjay Bhargava",
     "voice_id": "MXGyTMlsvQgQ4BL0emIa",
     "system_prompt": "You are Sanjay Bhargava, a founding member of PayPal and former SpaceX India head. You're an AI version of the real Sanjay, offering warm, practical financial guidance based on decades of experience in fintech and investing...",
     "first_message": "Hi there! I'm the AI version of Sanjay Bhargava, one of the founding members of PayPal. I've spent decades helping people build wealth and achieve what I call 'Zero Financial Anxiety.' What's on your mind financially today?"
   }
   ```

## Step 2: Configure Webhook Tools

Add the following webhook tools to your agent:

### Stock Analysis Tool
- **Name**: Stock Analysis
- **Description**: Get real-time stock data and fundamental analysis
- **URL**: `https://your-domain.com/api/webhooks/stock-analysis`
- **Method**: POST
- **Parameters**:
  ```json
  {
    "symbol": "string (required)",
    "analysis_type": "string (optional: quick/full)"
  }
  ```

### Portfolio Review Tool
- **Name**: Portfolio Review
- **Description**: Analyze portfolio allocation and provide recommendations
- **URL**: `https://your-domain.com/api/webhooks/portfolio-review`
- **Method**: POST
- **Parameters**:
  ```json
  {
    "portfolio_data": {
      "holdings": [
        {
          "symbol": "string",
          "shares": "number",
          "averageCost": "number"
        }
      ],
      "cashBalance": "number (optional)"
    }
  }
  ```

### Financial Planning Tool
- **Name**: Financial Planning
- **Description**: Calculate savings goals and retirement planning
- **URL**: `https://your-domain.com/api/webhooks/financial-planning`
- **Method**: POST
- **Parameters**:
  ```json
  {
    "age": "number",
    "income": "number",
    "goals": [
      {
        "type": "string",
        "targetAmount": "number",
        "timeframe": "number"
      }
    ]
  }
  ```

### Market Insights Tool
- **Name**: Market Insights
- **Description**: Get current market trends and economic indicators
- **URL**: `https://your-domain.com/api/webhooks/market-insights`
- **Method**: POST
- **Parameters**:
  ```json
  {
    "sector": "string (optional)",
    "timeframe": "string (optional: near-term/long-term)"
  }
  ```

## Step 3: Configure Post-Call Webhook

1. **Set up Post-Call Webhook**
   - URL: `https://your-domain.com/api/webhooks/post-call`
   - Method: POST
   - Type: Transcription webhook

2. **Copy Webhook Secret**
   - Save the webhook secret provided by ElevenLabs
   - Add it to your `.env` file as `ELEVENLABS_WEBHOOK_SECRET`

## Step 4: Environment Configuration

Create a `.env.local` file with the following variables:

```env
# ElevenLabs Configuration
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_api_key_here
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret_here

# Claude AI Configuration
ANTHROPIC_API_KEY=your_anthropic_key_here

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Step 5: Agent Configuration Details

### Voice Settings
- **Voice**: Sanjay's custom voice (MXGyTMlsvQgQ4BL0emIa)
- **Stability**: 0.6
- **Similarity Boost**: 0.8
- **Style**: 0.4
- **Use Speaker Boost**: True

### Conversation Settings
- **Model**: GPT-4 or Claude 3.5 Sonnet (recommended)
- **Temperature**: 0.7
- **Max Response Length**: 150 words
- **Response Delay**: Minimal for natural conversation flow

### Advanced Settings
- **Interruption Handling**: Enabled
- **Background Noise Filtering**: Enabled
- **Echo Cancellation**: Enabled
- **Latency Optimization**: Enabled

## Step 6: Testing Your Agent

1. **Test Basic Conversation**
   - Start with simple greetings
   - Ask about financial topics
   - Verify voice quality and response accuracy

2. **Test Webhook Tools**
   ```
   User: "Can you analyze Apple stock for me?"
   Expected: Agent uses Stock Analysis webhook and provides detailed response
   
   User: "Help me plan for retirement"
   Expected: Agent uses Financial Planning webhook with user's details
   ```

3. **Test Post-Call Webhook**
   - Complete a conversation
   - Verify transcript is received at your webhook endpoint
   - Check that session data is properly processed

## Step 7: Production Deployment

1. **Security Configuration**
   - Enable webhook signature verification
   - Use HTTPS for all webhook endpoints
   - Implement rate limiting on webhook endpoints

2. **Monitoring**
   - Monitor webhook response times
   - Track conversation completion rates
   - Monitor voice quality metrics

3. **Scaling Considerations**
   - Implement proper error handling for webhook failures
   - Add retry logic for failed webhook calls
   - Consider caching frequently requested data

## Troubleshooting

### Common Issues

1. **Agent Not Responding**
   - Check agent ID is correct in environment variables
   - Verify API key has Conversational AI permissions
   - Check agent is published and active

2. **Webhook Failures**
   - Verify webhook URLs are accessible from ElevenLabs servers
   - Check webhook signature verification is working
   - Review webhook endpoint logs for errors

3. **Voice Quality Issues**
   - Verify Sanjay's voice is available in your account
   - Check voice settings match recommended values
   - Test in different network conditions

### Support Resources

- [ElevenLabs Conversational AI Documentation](https://elevenlabs.io/docs/conversational-ai/overview)
- [Webhook Configuration Guide](https://elevenlabs.io/docs/conversational-ai/workflows/post-call-webhooks)
- [Voice Settings Optimization](https://elevenlabs.io/docs/voice-lab/voice-settings)

## Next Steps

Once your agent is configured:

1. Customize the agent's responses based on user feedback
2. Add more sophisticated financial tools and integrations
3. Implement user authentication and personalization
4. Add conversation analytics and reporting
5. Consider A/B testing different conversation flows

Your ElevenLabs Conversational AI agent is now ready to provide sophisticated financial advisory conversations with seamless voice interaction and intelligent webhook integrations!