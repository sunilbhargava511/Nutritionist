import { UserSettings, VoicePreferences, ConversationPreferences, UIPreferences } from '@/types/settings';

export class SettingsStorage {
  private static readonly SETTINGS_KEY = 'financial_advisor_settings';
  private static readonly DEFAULT_SETTINGS: UserSettings = {
    id: 'default',
    voice: {
      selectedPreset: 'professional',
      customSettings: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.3,
        useSpeakerBoost: true
      },
      speechSpeed: 1.0,
      autoInterrupt: true,
      enableVoiceInput: true
    },
    conversation: {
      autoNotes: true,
      noteTypes: {
        insights: true,
        actions: true,
        recommendations: true,
        questions: true
      },
      maxNotesPerSession: 5,
      sessionSummary: true,
      enableCitations: true,
      knowledgeBasePriority: true
    },
    ui: {
      theme: 'auto',
      showTranscript: false,
      compactView: false,
      animationsEnabled: true,
      autoPlayIntroduction: true
    },
    lastUpdated: new Date()
  };

  static getSettings(): UserSettings {
    try {
      const stored = localStorage.getItem(this.SETTINGS_KEY);
      if (!stored) return this.DEFAULT_SETTINGS;
      
      const settings = JSON.parse(stored, this.dateReviver);
      return { 
        ...this.DEFAULT_SETTINGS, 
        ...settings, 
        // Merge nested objects properly
        voice: { ...this.DEFAULT_SETTINGS.voice, ...settings.voice },
        conversation: { 
          ...this.DEFAULT_SETTINGS.conversation, 
          ...settings.conversation,
          noteTypes: { ...this.DEFAULT_SETTINGS.conversation.noteTypes, ...settings.conversation?.noteTypes }
        },
        ui: { ...this.DEFAULT_SETTINGS.ui, ...settings.ui },
        lastUpdated: settings.lastUpdated ? new Date(settings.lastUpdated) : new Date()
      };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return this.DEFAULT_SETTINGS;
    }
  }

  static saveSettings(settings: Partial<UserSettings>): void {
    try {
      const current = this.getSettings();
      const updated: UserSettings = {
        ...current,
        ...settings,
        // Handle nested object updates properly
        voice: settings.voice ? { ...current.voice, ...settings.voice } : current.voice,
        conversation: settings.conversation ? { 
          ...current.conversation, 
          ...settings.conversation,
          noteTypes: settings.conversation.noteTypes 
            ? { ...current.conversation.noteTypes, ...settings.conversation.noteTypes }
            : current.conversation.noteTypes
        } : current.conversation,
        ui: settings.ui ? { ...current.ui, ...settings.ui } : current.ui,
        lastUpdated: new Date()
      };
      
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(updated, this.dateReplacer));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  static updateVoiceSettings(voiceSettings: Partial<VoicePreferences>): void {
    this.saveSettings({ voice: voiceSettings as any });
  }

  static updateConversationSettings(conversationSettings: Partial<ConversationPreferences>): void {
    this.saveSettings({ conversation: conversationSettings as any });
  }

  static updateUISettings(uiSettings: Partial<UIPreferences>): void {
    this.saveSettings({ ui: uiSettings as any });
  }

  static resetSettings(): void {
    localStorage.removeItem(this.SETTINGS_KEY);
  }

  static exportSettings(): string {
    const settings = this.getSettings();
    return JSON.stringify(settings, this.dateReplacer, 2);
  }

  static importSettings(settingsJson: string): boolean {
    try {
      const settings = JSON.parse(settingsJson, this.dateReviver);
      this.saveSettings(settings);
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  // Utility functions for Date serialization (matching existing patterns)
  private static dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private static dateReviver(key: string, value: any): any {
    if (typeof value === 'object' && value !== null && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }
}