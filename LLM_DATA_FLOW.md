# LLM Data Flow Documentation

## Overview

This document provides a comprehensive breakdown of what data is passed to the Language Learning Models (Claude) at different points in the Financial Advisor application. Understanding this data flow is crucial for developers working on AI interactions, prompt engineering, and system optimization.

## Table of Contents

1. [System Prompts (Context Setup)](#1-system-prompts-context-setup)
2. [Conversation Context (Message History)](#2-conversation-context-message-history)
3. [Knowledge Base Integration (RAG)](#3-knowledge-base-integration-rag)
4. [Educational Session Content](#4-educational-session-content)
5. [Special Context Additions](#5-special-context-additions)
6. [Model Configuration](#6-model-configuration)
7. [Metadata and Variables](#7-metadata-and-variables)
8. [Opening Messages](#8-opening-messages)
9. [Data Flow Examples](#9-data-flow-examples)

## 1. System Prompts (Context Setup)

System prompts are stored in the database and retrieved based on the conversation context. They define the AI's personality, behavior, and expertise domain.

### a. General Q&A Conversations

**Database Query**: `type = 'qa'` in `system_prompts` table

**Default Prompt**:
```text
You are Sanjay, a warm, empathetic AI financial advisor who specializes in helping people develop healthy relationships with money. 

Your approach:
- Listen actively and ask thoughtful follow-up questions
- Provide practical, actionable advice
- Help clients identify emotional patterns around money
- Offer personalized strategies for financial wellness
- Maintain a supportive, non-judgmental tone
- Focus on behavioral change and sustainable habits

Keep responses conversational, warm, and focused on the human experience of financial decision-making.
```

### b. Lesson-based Q&A

**Database Query**: `type = 'lesson_qa'` AND `lessonId = [specific_lesson]`

**Default Prompt**:
```text
You are conducting a Q&A session after the user has completed a financial education lesson. Focus on:
- Helping them understand and apply the lesson concepts
- Encouraging questions about the material
- Connecting theory to their personal financial situation
- Reinforcing key takeaways from the lesson
- Maintaining engagement and enthusiasm for learning
```

### c. Educational Content Sessions

**Database Query**: `type = 'content'`

Used for delivering personalized educational content with adaptive responses based on user engagement.

## 2. Conversation Context (Message History)

### Voice Conversations (ElevenLabs Integration)

The complete conversation transcript is passed to Claude, including:

```javascript
// Data structure passed to LLM
{
  messages: [
    {
      role: 'user',
      content: "User's first message"
    },
    {
      role: 'assistant',
      content: "Assistant's response"
    },
    {
      role: 'user',
      content: "User's follow-up question"
    }
    // ... complete conversation history
  ],
  systemPrompt: "Retrieved system prompt based on context"
}
```

### Message Types Included

- **user_voice**: Voice input from user
- **assistant_voice**: AI responses
- **opening_message**: Initial greeting or lesson intro
- **system_message**: System notifications

### Context Building Process

1. Retrieve all messages from session transcript
2. Convert to Claude-compatible format (user/assistant pairs)
3. Maintain chronological order
4. Include metadata for context awareness

## 3. Knowledge Base Integration (RAG)

When Retrieval-Augmented Generation is enabled, the system enhances prompts with relevant knowledge base content.

### Knowledge Context Enhancement

```javascript
// Enhanced prompt structure
const enhancedPrompt = `${basePrompt}

RELEVANT KNOWLEDGE BASE CONTENT:
${contextSummary}

Use this context to provide informed, specific advice while maintaining your warm, conversational tone.`;
```

### RAG Process Flow

1. **Search**: Query knowledge base for relevant articles (top 3 results)
2. **Score**: Calculate relevance scores based on:
   - Title matching
   - Content similarity
   - Tag relevance
   - Category alignment
3. **Summarize**: Generate context summary from matched articles
4. **Inject**: Add knowledge context to system prompt
5. **Cite**: Return article references for transparency

### Search Result Structure

```javascript
{
  article: {
    id: "article_id",
    title: "Article Title",
    summary: "Brief summary",
    content: "Full article content",
    category: "Financial Planning",
    tags: ["budgeting", "savings"]
  },
  relevanceScore: 0.85,
  matchedFields: ["title", "content"]
}
```

## 4. Educational Session Content

For structured educational sessions, the LLM receives:

### Current Chunk Data

```javascript
{
  chunkId: "chunk_123",
  orderIndex: 0,
  title: "Introduction to Budgeting",
  content: "Educational content text...",
  question: "What's your biggest budgeting challenge?",
  active: true
}
```

### Session Context

- **Previous responses**: User's answers to earlier chunks
- **Session metadata**: Personalization settings, progress tracking
- **Chunk progression**: Current position in educational sequence

### Personalization Logic

```javascript
if (session.personalizationEnabled) {
  // Full conversation history for personalized response
  aiResponse = await claudeService.sendMessage(messages, systemPrompt);
} else {
  // Simple acknowledgment and progression
  aiResponse = "Thank you for your response. Let's move on to the next topic.";
}
```

## 5. Special Context Additions

### For Lesson Q&A Sessions

Additional context injected for lesson-based conversations:

```javascript
{
  lessonTitle: "Why learn about Zero Financial anxiety Now?",
  videoSummary: "Key concepts from the video...",
  lessonQuestion: "Are you ready to explore the seven steps?",
  lessonTranscript: [...previousMessages],
  lessonPhase: "qa_conversation"
}
```

### For Session Summaries

Special prompt for generating concise summaries:

```javascript
{
  action: "generateSummary",
  maxTokens: 500,
  summaryPrompt: "Analyze this financial counseling conversation and provide a concise session summary focusing on key topics, concerns, and outcomes.",
  messages: [...completeConversation]
}
```

### For Auto-generated Notes

Structured note extraction with specific format requirements:

```javascript
{
  action: "extractNotes",
  format: "json",
  noteTypes: ["insight", "action", "recommendation", "question"],
  maxNotes: 5,
  priorityLevels: ["high", "medium", "low"]
}
```

## 6. Model Configuration

### Default Settings

```javascript
const CONVERSATION_CONSTANTS = {
  CLAUDE_MODEL: 'claude-3-5-sonnet-20241022',
  MAX_RESPONSE_TOKENS: 4000,
  DEFAULT_TEMPERATURE: 0.7,
  MAX_VOICE_CLEANUP_TOKENS: 1000,
  MAX_SESSION_SUMMARY_TOKENS: 500,
  MAX_NOTE_EXTRACTION_TOKENS: 1000
};
```

### Context-Specific Configurations

| Context | Temperature | Max Tokens | Purpose |
|---------|------------|------------|---------|
| General Conversation | 0.7 | 4000 | Natural, engaging responses |
| JSON Extraction | 0.3 | 1000 | Structured, consistent output |
| Summaries | 0.4 | 500 | Concise, accurate summaries |
| Note Generation | 0.4 | 1000 | Actionable insights |

## 7. Metadata and Variables

### Request Metadata

Every LLM request includes:

```javascript
{
  sessionId: "session_abc123",
  conversationId: "conv_xyz789",
  sessionType: "lesson_based" | "open_ended",
  lessonPhase: "intro" | "video" | "qa",
  messageCount: 15,
  requestId: "req_timestamp_random",
  timestamp: "2024-01-19T10:30:00Z"
}
```

### ElevenLabs Variables

For voice conversations, additional variables:

```javascript
{
  conversation_id: "elevenlabs_conv_id",
  session_id: "internal_session_id",
  session_type: "lesson_based",
  lesson_phase: "qa_conversation",
  is_lesson_based: true,
  lesson_id: "lesson_123",
  message_count: 10
}
```

## 8. Opening Messages

Opening messages are **not** passed to the LLM for generation but are pre-stored and played directly:

### Types of Opening Messages

1. **General Opening**: For open-ended conversations
2. **Lesson Intro**: For educational content introduction

### Storage Structure

```javascript
{
  id: "opening_general_timestamp",
  type: "general_opening" | "lesson_intro",
  messageContent: "Pre-written opening message",
  voiceSettings: {
    voiceId: "MXGyTMlsvQgQ4BL0emIa",
    stability: 0.6,
    similarity_boost: 0.8,
    style: 0.4,
    use_speaker_boost: true
  },
  lessonId: "lesson_123", // For lesson intros
  active: true
}
```

## 9. Data Flow Examples

### Example 1: Open-ended Conversation Start

```javascript
// 1. User initiates conversation
userInput: "I want to talk about my savings goals"

// 2. System retrieves context
systemPrompt: getGeneralPrompt() // from database
previousMessages: [] // First message

// 3. LLM receives
{
  messages: [
    { role: "user", content: "I want to talk about my savings goals" }
  ],
  system: "You are Sanjay, a warm, empathetic AI financial advisor..."
}

// 4. LLM responds
response: "I'd love to help you with your savings goals! Tell me, what specific goals are you working towards?"
```

### Example 2: Lesson Q&A with Knowledge Base

```javascript
// 1. User asks question after video
userInput: "How do I actually start an emergency fund?"

// 2. System builds context
lessonContext: getLessonSpecificPrompt(lessonId)
knowledgeResults: searchKnowledgeBase("emergency fund", 3)
conversationHistory: getSessionTranscript(sessionId)

// 3. LLM receives
{
  messages: [
    // ... previous conversation
    { role: "user", content: "How do I actually start an emergency fund?" }
  ],
  system: `You are conducting a Q&A session after the user has completed a financial education lesson...
  
  RELEVANT KNOWLEDGE BASE CONTENT:
  - Article: "Building Your Emergency Fund: A Step-by-Step Guide"
  - Key points: Start with $1000, automate savings, use high-yield account
  
  Use this context to provide informed, specific advice...`
}

// 4. LLM responds with cited knowledge
response: "Great question! Based on what we covered in the lesson and proven strategies, here's how to start your emergency fund..."
```

### Example 3: Session Summary Generation

```javascript
// 1. Session ends, summary requested
action: "generateSummary"

// 2. System prepares data
completeTranscript: getAllMessages(sessionId)
summaryPrompt: "Analyze this financial counseling conversation..."

// 3. LLM receives
{
  messages: [
    // Complete conversation history
  ],
  system: "Generate a concise 2-3 sentence summary focusing on key topics, concerns, and outcomes",
  max_tokens: 500,
  temperature: 0.4
}

// 4. LLM generates summary
summary: "Client discussed anxiety about retirement planning and learned strategies for automatic investing. Key action items include setting up a monthly auto-transfer and reviewing investment allocations quarterly."
```

## Key Principles

1. **Full Context**: Always pass complete conversation history for continuity
2. **Dynamic Prompts**: System prompts loaded from database based on context
3. **Knowledge Enhancement**: RAG integration when relevant information exists
4. **Session Awareness**: Different prompts and contexts for different session types
5. **Consistent Formatting**: All messages formatted as user/assistant pairs
6. **Metadata Preservation**: Track session details for analytics and debugging
7. **Separation of Concerns**: Pre-written content (opening messages) vs. dynamic generation

## Security Considerations

- LLM never sees raw database records
- User PII is not included in prompts unless necessary for context
- API keys and sensitive configuration never passed to LLM
- All data sanitized before sending to external APIs

## Performance Optimizations

1. **Caching**: Knowledge base articles cached for 5 minutes
2. **Token Limits**: Different limits for different operations
3. **Temperature Tuning**: Lower for structured output, higher for conversation
4. **Prompt Compression**: Remove redundant context when approaching token limits
5. **Batch Processing**: Multiple notes extracted in single LLM call

## Monitoring and Debugging

Every LLM interaction logs:
- Request ID for tracing
- Token usage for cost tracking
- Response time for performance monitoring
- Error details for debugging
- Session context for replay capability

---

*Last Updated: January 2025*
*Version: 1.0*