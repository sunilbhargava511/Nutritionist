# NutritionAssist - AI Voice-Enabled Learning Platform

A sophisticated nutrition learning application featuring AI-powered conversations, voice interaction, session notebooks, and a comprehensive knowledge base. Built with evidence-based nutrition science and practical wellness strategies.

## 🌟 Features

### Core Functionality
- **Voice-First Interaction**: Web Speech Recognition API with AI transcript cleanup
- **AI-Powered Responses**: Claude integration with contextual knowledge base
- **Session Notebooks**: Automatic note extraction and session management
- **Knowledge Base**: Searchable articles with evidence-based nutrition guidance
- **Persistent Sessions**: Local storage with export capabilities

### Key Capabilities
- **Smart Voice Processing**: Real-time transcription with AI-powered cleanup
- **Context-Aware Responses**: Articles inform conversation responses
- **Automatic Note-Taking**: AI extracts insights, actions, and recommendations
- **Session Management**: Track progress across multiple nutrition learning sessions
- **Export Functionality**: Download session summaries and notes

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Anthropic API key (Claude)
- Modern browser with Web Speech API support

### Installation

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd financial-advisor
   npm install
   ```

2. **Environment Setup**
   Create a `.env.local` file with your API keys:
   ```env
   ANTHROPIC_API_KEY=your_claude_api_key_here
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here # Optional
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

4. **Open Application**
   Visit `http://localhost:3000`

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: Anthropic Claude API
- **Voice**: Web Speech Recognition API
- **Icons**: Lucide React
- **Storage**: Browser localStorage (sessions/notes)

### Project Structure
```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes (Claude integration)
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── chat/              # Chat interface components
│   ├── voice/             # Voice recording components
│   ├── notebook/          # Session notebook components
│   └── knowledge/         # Knowledge base components
├── data/                  # Static data files
│   └── prompts.json       # AI prompts and templates
├── lib/                   # Utility libraries
│   ├── claude.ts          # Claude API integration
│   ├── voice.ts           # Voice recording logic
│   └── sessionStorage.ts  # Session management
└── types/                 # TypeScript type definitions
```

## 💬 How It Works

### Voice Interaction Flow
1. User starts voice recording
2. Web Speech API transcribes speech in real-time
3. AI cleans up transcript for clarity
4. System searches knowledge base for relevant articles
5. Claude generates response with article context
6. AI extracts and saves key insights to session notebook

### Session Management
- Each session has persistent notes and message history
- AI automatically extracts insights, actions, and recommendations
- Sessions can be exported as text files
- Session summaries generated on demand

### Knowledge Integration
- Knowledge base powered by dynamic document loading
- AI responses informed by uploaded knowledge documents
- Smart search for relevant content matching

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect GitHub repository to Vercel
   - Add environment variables in Vercel dashboard:
     ```
     ANTHROPIC_API_KEY=your_claude_api_key
     ELEVENLABS_API_KEY=your_elevenlabs_key (optional)
     ```
   - Deploy automatically

### Local Production Build
```bash
npm run build
npm start
```

## 📚 Sanjay's Financial Expertise

The knowledge base includes Sanjay Bhargava's key strategies:

- **Social Security Optimization**: "Low at 62, High at 70" strategy for couples
- **Early Investment**: $270/month path to millionaire status starting at 22
- **Retirement Planning**: Safe withdrawal rate calculations and planning
- **Estate Planning**: Understanding nominees vs. heirs, will creation
- **Mortgage Decisions**: Mathematical and psychological factors
- **Zero Financial Anxiety**: Systematic approach to financial confidence

## 🛠️ Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build production version
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🔒 Privacy & Security

- All session data stored locally in browser
- No personal financial data transmitted to servers
- API keys stored securely in environment variables
- Sessions can be exported and deleted by user

## 🆘 Troubleshooting

### Common Issues

**Voice not working?**
- Check browser compatibility (Chrome/Safari recommended)
- Ensure microphone permissions granted
- Verify HTTPS connection (required for speech API)

**AI responses not working?**
- Verify ANTHROPIC_API_KEY is set correctly
- Check API key has sufficient credits
- Review browser console for errors

**Session not saving?**
- Check if localStorage is enabled in browser
- Verify no browser extensions blocking storage
- Try in incognito/private mode

---

**Built with ❤️ for achieving Zero Financial Anxiety**
