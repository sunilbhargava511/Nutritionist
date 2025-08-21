# Financial Advisor LLM Architecture Documentation

This document describes exactly how the Financial Advisor AI application uses Claude (Anthropic's LLM), including system prompts, knowledge base integration, conversation flow, and technical implementation.

## 🧠 **Core LLM Integration**

### **Primary LLM: Claude 3.5 Sonnet**
- **Model**: `claude-3-5-sonnet-20241022`
- **Max Tokens**: 4,000
- **Temperature**: 0.7 (balanced creativity and consistency)
- **Provider**: Anthropic API via `@anthropic-ai/sdk`

### **Key Technical Components**
1. **`EnhancedClaudeService`** - Main LLM integration service
2. **RAG (Retrieval-Augmented Generation)** - Knowledge base integration
3. **Session Management** - Conversation state and note-taking
4. **Voice Integration** - ElevenLabs TTS for voice conversations

---

## 🎯 **System Prompts & AI Personality**

### **Primary Identity: Sanjay Bhargava AI**
The AI presents itself as the AI version of Sanjay Bhargava (PayPal founding member) who communicates in the style of Morgan Housel, focusing on behavioral finance and the psychology of money decisions.

### **Core System Prompt Structure**

```typescript
// Located: src/lib/system-prompts.ts
SYSTEM_PROMPTS = {
  financial_advisor: `You are the AI version of Sanjay Bhargava, but you communicate in the style of Morgan Housel - focusing on behavioral insights, storytelling, and the psychology behind money decisions. You help senior investors in India understand retirement not just as a math problem, but as a human behavior challenge.

  COMMUNICATION STYLE (Morgan Housel Approach):
  - Use stories and examples to explain concepts
  - Focus on psychology over pure math
  - Acknowledge that money decisions are emotional, not just logical
  - Use conversational, accessible language
  - Help people understand their own behavioral biases
  - Emphasize that everyone's relationship with money is unique

  CRITICAL FOCUS: You ONLY discuss retirement planning topics. For ANY non-retirement question, redirect with understanding:
  "I focus exclusively on the psychology of retirement decisions - that's where the real magic happens in financial planning."
  `
```

### **Conversation Flow Design**

The system prompt enforces a **Two-Part Conversation Structure**:

#### **Part 1: Strategy Presentation** (Educational)
1. **Simple Introduction**: "Hi! I'm the AI version of Sanjay Bhargava..."
2. **Story-Driven Hook**: Presents the retirement approach through behavioral psychology
3. **Three 2-minute chunks** with insight questions:
   - **Chunk 1**: Problem with traditional advice, introduce 2-fund solution
   - **Chunk 2**: Corpus-based allocation (revolutionary logic)
   - **Chunk 3**: Behavioral shields and withdrawal rules

#### **Part 2: Strategy Customization** (Personalized)
- Apply strategy to user's specific situation
- Address unique behavioral patterns and fears
- Provide specific allocations and recommendations
- Make it personal based on Part 1 observations

---

## 📚 **Knowledge Base Architecture**

### **RAG Implementation**
The system uses **Retrieval-Augmented Generation** to enhance Claude's responses with specific knowledge articles.

```typescript
// Located: src/lib/knowledge-search.ts
export class KnowledgeSearchService {
  // Searches knowledge base for relevant articles
  findRelevantArticles(userMessage: string, limit: number = 3): SearchResult[]
  
  // Generates context summary for Claude
  generateContextSummary(results: SearchResult[]): string
}
```

### **Knowledge Base Content**
Three main knowledge articles power the system:

1. **Senior Investor's Playbook** (`senior-investors-playbook.ts`)
   - Core retirement strategy
   - Two-fund approach (60% Nifty 50 Index, 40% Arbitrage)
   - 3% withdrawal rule
   - Corpus-based allocation strategy

2. **Playbook Q&A** (`playbook-qa.ts`)
   - Common questions and detailed answers
   - Edge cases and clarifications
   - Behavioral psychology explanations

3. **Playbook Timeline** (`playbook-timeline.ts`)
   - Implementation steps
   - Timeline for strategy execution
   - Milestones and checkpoints

### **Knowledge Search Algorithm**
```typescript
// Scoring system for article relevance
const weights = {
  title: 3.0,        // Highest weight for title matches
  summary: 2.0,      // Summary matches
  tags: 2.5,         // Tag matches
  content: 1.0,      // Content matches (can have multiple)
  category: 1.5      // Category matches
};
```

---

## 🔄 **Conversation Flow Implementation**

### **RAG-Enhanced Response Generation**
Every user message goes through this process:

```typescript
// Located: src/lib/claude-enhanced.ts
async sendMessageWithContext(messages: Message[], userMessage: string): Promise<RAGResponse> {
  // 1. Search knowledge base for relevant articles
  const searchResults = knowledgeSearch.findRelevantArticles(userMessage, 3);
  
  // 2. Generate context summary from search results
  const contextSummary = knowledgeSearch.generateContextSummary(searchResults);
  
  // 3. Create enhanced system prompt with context
  const enhancedPrompt = contextSummary 
    ? `${SYSTEM_PROMPTS.financial_advisor_with_context}

RELEVANT KNOWLEDGE BASE CONTENT:
${contextSummary}

Use this context to provide informed, specific advice while maintaining your warm, conversational tone.`
    : SYSTEM_PROMPTS.financial_advisor;

  // 4. Send to Claude with enhanced prompt
  const response = await this.sendMessage(messages, enhancedPrompt);
  
  // 5. Return response with citations
  return {
    response,
    citedArticles: searchResults.map(r => r.article),
    searchResults
  };
}
```

### **Voice Optimization**
Special formatting for ElevenLabs Text-to-Speech:

```typescript
VOICE SYNTHESIS REQUIREMENTS:
- Write "sixty percent" not "60%"
- Write "one crore rupees" not "1Cr"  
- Write "forty percent" not "40%"
- Write "three to four percent" not "3-4%"
- Keep responses under 45 seconds to read aloud
- Never use asterisk actions like *laughs* or *chuckles*
- Avoid special characters and symbols
```

---

## 🤖 **ElevenLabs Integration**

### **Webhook-Driven Conversations**
The system integrates with ElevenLabs Conversational AI through webhooks:

```typescript
// Located: src/app/api/elevenlabs-webhook/route.ts
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Parse ElevenLabs webhook request
  const { messages, variables } = await request.json();
  
  // 2. Extract user message
  const userMessage = messages[messages.length - 1];
  
  // 3. Resolve session with retry logic
  const session = await sessionManager.resolveSessionWithRetry();
  
  // 4. Generate Claude response with RAG
  const response = await claudeService.sendMessageWithContext(formattedMessages, userInput);
  
  // 5. Return in ElevenLabs expected format
  return NextResponse.json({
    content: response.response,
    variables: {
      ...variables,
      current_topic: nextTopic,
      session_id: session.sessionId
    }
  });
}
```

### **Conversation State Management**
```typescript
// Located: src/lib/elevenlabs-session-manager.ts
export class SessionManager {
  // Session resolution with retry logic for webhook reliability
  async resolveSessionWithRetry(maxRetries: number = 3): Promise<SessionData | null>
  
  // Message storage and activity tracking
  async addMessage(sessionId: string, message: SessionMessage): Promise<void>
  
  // Conversation-to-session mapping for ElevenLabs integration
  async mapConversationToSession(conversationId: string, sessionId: string): Promise<void>
}
```

---

## 📝 **Auto-Note Generation**

### **Session Analysis**
Claude automatically generates structured notes from conversations:

```typescript
// Three types of note extraction:

1. **Session Summary**: 
   - 2-3 sentence overview of conversation
   - Key topics and outcomes
   
2. **Structured Notes**: 
   - JSON format: {"type": "insight|action|recommendation|question", "content": "...", "priority": "high|medium|low"}
   - Filtered by configuration (insights, actions, recommendations, questions)
   
3. **Auto Therapist Notes**:
   - Behavioral analysis of client's money relationship  
   - Action items and follow-up questions
   - Progress indicators
```

### **Note Types & Configuration**
```typescript
interface AutoNoteConfig {
  maxNotes: number;                    // Default: 5
  extractInsights: boolean;           // Default: true
  extractActions: boolean;            // Default: true  
  extractQuestions: boolean;          // Default: true
  extractRecommendations: boolean;    // Default: true
}
```

---

## 🎙️ **Voice Conversation Flow**

### **Complete Voice Pipeline**
1. **User speaks** → ElevenLabs Speech-to-Text
2. **ElevenLabs** → Webhook to `/api/elevenlabs-webhook`
3. **Webhook** → Claude with RAG enhancement
4. **Claude response** → Back to ElevenLabs
5. **ElevenLabs TTS** → User hears response

### **Session Registration Pattern**
```typescript
// Frontend registers sessions when starting conversations
await fetch('/api/register-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: currentSession.id,
    conversationId: elevenLabsConversationId,
    timestamp: new Date().toISOString()
  })
});
```

---

## 🛠️ **Technical Architecture**

### **Key Files & Their Roles**

1. **`src/lib/claude-enhanced.ts`**
   - Main Claude service integration
   - RAG implementation
   - Note generation methods
   - Configuration management

2. **`src/lib/system-prompts.ts`**
   - All LLM personality definitions
   - Conversation flow instructions
   - Voice optimization requirements

3. **`src/lib/knowledge-search.ts`**
   - Knowledge base search engine
   - Article relevance scoring
   - Context summary generation

4. **`src/lib/elevenlabs-session-manager.ts`**
   - Session state management
   - ElevenLabs conversation mapping
   - Message storage and retrieval

5. **`src/app/api/elevenlabs-webhook/route.ts`**
   - ElevenLabs webhook handler
   - Response generation pipeline
   - Session resolution logic

### **Data Flow Architecture**
```
User Input (Voice/Text)
      ↓
ElevenLabs (if voice) → Webhook
      ↓
Session Resolution
      ↓
Knowledge Base Search (RAG)
      ↓
Claude API Call (Enhanced Prompt)
      ↓
Response + Auto-Notes Generation  
      ↓
ElevenLabs TTS (if voice) → User
```

---

## 🎯 **LLM Behavioral Design**

### **Conversation Constraints**
- **Topic Restriction**: ONLY retirement planning discussions
- **Redirect Pattern**: "I focus exclusively on retirement planning..."
- **Indian Market Focus**: All advice tailored for Indian investors
- **Behavioral Psychology**: Emphasis on emotions over pure mathematics

### **Response Structure**
1. **Lead with Psychology**: Address emotional concerns first
2. **Use Stories**: Morgan Housel-style narrative approach
3. **Practical Application**: Connect theory to user's situation
4. **Voice Optimization**: All responses formatted for speech synthesis

### **Quality Controls**
- **Knowledge Base Validation**: All responses backed by documented articles
- **Fallback Responses**: Graceful degradation when knowledge is incomplete
- **Session Continuity**: Auto-notes ensure conversation context persists
- **Error Recovery**: Robust session management prevents conversation loss

---

## 🔧 **Configuration & Customization**

### **LLM Configuration**
```typescript
static readonly DEFAULT_CONFIG: ClaudeConfig = {
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4000,
  temperature: 0.7,
  systemPrompt: SYSTEM_PROMPTS.financial_advisor
};
```

### **Environment Variables**
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=your_agent_id
```

### **Customization Points**
- **System Prompts**: Modify personality and conversation style
- **Knowledge Base**: Add/update articles for different expertise areas
- **Auto-Note Configuration**: Adjust note extraction preferences
- **Voice Settings**: Customize TTS parameters for different personalities

---

This architecture creates a sophisticated AI financial advisor that combines Claude's conversational abilities with domain-specific knowledge, behavioral psychology principles, and seamless voice interaction capabilities.