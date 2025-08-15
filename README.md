# Nutritionist Assistant Platform

A white-label voice assistant platform that serves as a digital alter ego for nutritionists, enabling them to scale their practice through AI-powered conversations with their patients.

## Features

### Core Functionality
- **Free-form Conversations**: Open nutrition discussions with personalized guidance
- **Structured Lessons**: Guided, curriculum-based learning experiences
- **Voice Integration**: 11Labs text-to-speech for natural voice interactions
- **Patient Profiles**: Automatic tracking of allergies, preferences, and dietary restrictions
- **Conversation Reports**: Detailed summaries with action items and insights

### For Nutritionists
- **Content Creation**: Upload lessons from text, PDFs, documents, or web content
- **Analytics Dashboard**: Track patient engagement and popular topics
- **Patient Management**: Monitor individual patient progress and insights
- **White-label Branding**: Custom subdomain and branding configuration

### For Patients
- **Google Authentication**: Secure login with Google accounts
- **Invitation System**: Connect to nutritionists via invitation codes
- **Conversation History**: Access to all previous sessions and reports
- **Progress Tracking**: Monitor goals and dietary adherence

## Technology Stack

- **Backend**: Node.js with Express.js and TypeScript
- **Database**: SQLite with Sequelize ORM
- **AI/ML**: OpenAI GPT-4 for conversations
- **Voice**: 11Labs for text-to-speech synthesis
- **Authentication**: Google OAuth 2.0 + JWT
- **Real-time**: Socket.IO for live conversation updates
- **Deployment**: Railway platform ready

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- OpenAI API key
- 11Labs API key
- Google OAuth credentials

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd nutritionist-app
   npm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your API keys:
   ```env
   # Required API Keys
   OPENAI_API_KEY=your-openai-api-key
   ELEVENLABS_API_KEY=your-11labs-api-key
   ELEVENLABS_VOICE_ID=your-default-voice-id
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   
   # Security
   JWT_SECRET=your-jwt-secret-here
   SESSION_SECRET=your-session-secret-here
   ```

3. **Database setup**:
   ```bash
   npm run db:migrate
   npm run db:seed  # Optional: creates demo data
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Visit the application**:
   Open http://localhost:3000 in your browser

## API Endpoints

### Authentication
- `GET /api/auth/google` - Google OAuth login
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/refresh` - Refresh access token

### Conversations
- `POST /api/conversations/start` - Start new conversation
- `POST /api/conversations/:id/message` - Send message
- `POST /api/conversations/:id/end` - End conversation
- `GET /api/conversations/history` - Get conversation history
- `GET /api/conversations/:id/report` - Get conversation report

### Lessons
- `POST /api/lessons/create` - Create new lesson
- `GET /api/lessons/my-lessons` - Get user's lessons
- `PUT /api/lessons/:id` - Update lesson
- `POST /api/lessons/:id/publish` - Publish lesson
- `GET /api/lessons/search` - Search lessons

### Profile & Analytics
- `GET /api/profile/me` - Get user profile
- `PUT /api/profile/me` - Update profile
- `GET /api/analytics/dashboard` - Nutritionist dashboard
- `GET /api/analytics/patient-insights/:id` - Patient insights

## Usage Examples

### Starting a Conversation
```javascript
// Start free-form conversation
const response = await fetch('/api/conversations/start', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mode: 'free-form'
  })
});
```

### Creating a Lesson
```javascript
// Upload lesson content
const formData = new FormData();
formData.append('title', 'Understanding Nutrition');
formData.append('description', 'Basic nutrition principles');
formData.append('sourceType', 'text');
formData.append('content', 'Lesson content here...');
formData.append('chunkDurationMinutes', '5');

const response = await fetch('/api/lessons/create', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token },
  body: formData
});
```

## Deployment

### Railway Deployment

1. **Connect to Railway**:
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   ```

2. **Set environment variables**:
   ```bash
   railway variables set OPENAI_API_KEY=your-key
   railway variables set ELEVENLABS_API_KEY=your-key
   # ... add all required variables
   ```

3. **Deploy**:
   ```bash
   railway up
   ```

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=./database.sqlite
FRONTEND_URL=https://yourdomain.com
```

## Development

### Project Structure
```
src/
├── config/          # Database and passport configuration
├── models/          # Sequelize models
├── routes/          # Express route handlers
├── services/        # Business logic services
├── middleware/      # Custom middleware
├── db/             # Database migrations and seeds
└── server.ts       # Main application entry point
```

### Key Services
- **ConversationService**: Manages AI conversations and 11Labs integration
- **ContentIngestionService**: Processes various content types into lessons
- **ElevenLabsService**: Text-to-speech voice synthesis

### Adding New Features
1. Create model in `src/models/`
2. Add routes in `src/routes/`
3. Implement business logic in `src/services/`
4. Update database schema if needed

## Conversation Flow

### Free-form Mode
1. Patient asks nutrition question
2. AI provides personalized response based on patient profile
3. System extracts insights (allergies, preferences, etc.)
4. Response converted to speech via 11Labs
5. Conversation logged for reports

### Structured Mode
1. Patient selects lesson
2. Content delivered in chunks with Q&A periods
3. Progress tracked through lesson completion
4. Questions answered using nutritionist's knowledge base
5. Off-topic questions parked for later discussion

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API documentation
3. Contact support team

## License

Private - All rights reserved