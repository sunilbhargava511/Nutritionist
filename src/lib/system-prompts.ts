// System prompts are now managed through the admin panel database
// Only essential error messages and constants are kept here

export const ERROR_MESSAGES = {
  ANTHROPIC_API_KEY_MISSING: 'ANTHROPIC_API_KEY environment variable is required',
  PROMPT_NOT_FOUND: 'Required system prompt not found in database',
  CLAUDE_API_ERROR: 'Failed to get response from Claude API',
  VOICE_CLEANUP_FAILED: 'Voice transcript cleanup failed',
  SESSION_SUMMARY_FAILED: 'Session summary generation failed',
  NOTE_EXTRACTION_FAILED: 'Note extraction failed'
};

export const CONVERSATION_CONSTANTS = {
  MAX_RESPONSE_TOKENS: 4000,
  DEFAULT_TEMPERATURE: 0.7,
  CLAUDE_MODEL: 'claude-3-5-sonnet-20241022',
  MAX_VOICE_CLEANUP_TOKENS: 1000,
  MAX_SESSION_SUMMARY_TOKENS: 500,
  MAX_NOTE_EXTRACTION_TOKENS: 1000
};