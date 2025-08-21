export interface VoicePreferences {
  selectedPreset: 'professional' | 'casual' | 'storyteller';
  customSettings: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  speechSpeed: number;
  autoInterrupt: boolean;
  enableVoiceInput: boolean;
}

export interface ConversationPreferences {
  autoNotes: boolean;
  noteTypes: {
    insights: boolean;
    actions: boolean;
    recommendations: boolean;
    questions: boolean;
  };
  maxNotesPerSession: number;
  sessionSummary: boolean;
  enableCitations: boolean;
  knowledgeBasePriority: boolean; // Prioritize knowledge base over general AI knowledge
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'auto';
  showTranscript: boolean;
  compactView: boolean;
  animationsEnabled: boolean;
  autoPlayIntroduction: boolean;
}

export interface UserSettings {
  id: string;
  voice: VoicePreferences;
  conversation: ConversationPreferences;
  ui: UIPreferences;
  lastUpdated: Date;
}