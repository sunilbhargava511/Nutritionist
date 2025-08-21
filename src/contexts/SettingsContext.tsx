'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserSettings } from '@/types/settings';
import { SettingsStorage } from '@/lib/settings-storage';

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  resetSettings: () => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: SettingsStorage.getSettings(),
  updateSettings: () => {},
  resetSettings: () => {},
  isLoading: true
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(SettingsStorage.getSettings());
  const [isLoading, setIsLoading] = useState(true);

  // Initialize settings on mount
  useEffect(() => {
    try {
      const loadedSettings = SettingsStorage.getSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      SettingsStorage.saveSettings(updates);
      
      // Dispatch custom event for other components to listen to
      window.dispatchEvent(new CustomEvent('settingsUpdated', { 
        detail: newSettings 
      }));
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  }, [settings]);

  const resetSettings = useCallback(() => {
    try {
      SettingsStorage.resetSettings();
      const defaultSettings = SettingsStorage.getSettings();
      setSettings(defaultSettings);
      
      // Dispatch reset event
      window.dispatchEvent(new CustomEvent('settingsReset', { 
        detail: defaultSettings 
      }));
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

// Convenience hooks for specific settings sections
export function useVoiceSettings() {
  const { settings, updateSettings } = useSettings();
  
  const updateVoiceSettings = useCallback((voiceUpdates: Partial<UserSettings['voice']>) => {
    updateSettings({ voice: { ...settings.voice, ...voiceUpdates } });
  }, [settings.voice, updateSettings]);

  return {
    voiceSettings: settings.voice,
    updateVoiceSettings
  };
}

export function useConversationSettings() {
  const { settings, updateSettings } = useSettings();
  
  const updateConversationSettings = useCallback((conversationUpdates: Partial<UserSettings['conversation']>) => {
    updateSettings({ conversation: { ...settings.conversation, ...conversationUpdates } });
  }, [settings.conversation, updateSettings]);

  return {
    conversationSettings: settings.conversation,
    updateConversationSettings
  };
}

export function useUISettings() {
  const { settings, updateSettings } = useSettings();
  
  const updateUISettings = useCallback((uiUpdates: Partial<UserSettings['ui']>) => {
    updateSettings({ ui: { ...settings.ui, ...uiUpdates } });
  }, [settings.ui, updateSettings]);

  return {
    uiSettings: settings.ui,
    updateUISettings
  };
}