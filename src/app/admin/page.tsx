'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  Settings, 
  FileText, 
  Database,
  Save,
  Trash2,
  Plus,
  Eye,
  AlertCircle,
  GripVertical,
  Edit3,
  Download,
  BarChart3,
  ArrowLeft,
  MessageSquare,
  Volume2,
  Play,
  RefreshCw,
  Headphones,
  BarChart2,
  AlertTriangle,
  Activity,
  Terminal,
  Zap,
  Sparkles,
  Home
} from 'lucide-react';
import { 
  Lesson,
  AdminSettings, 
  SystemPrompt, 
  KnowledgeBaseFile,
  SessionReport 
} from '@/types';
import AppHeader from '@/components/AppHeader';

type AdminTab = 'overview' | 'lessons' | 'personas' | 'settings' | 'prompts' | 'knowledge' | 'reports' | 'opening-messages' | 'audio-management' | 'debug';
type SettingsTab = 'general' | 'ui';

interface Persona {
  id: string;
  name: string;
  description: string;
  prompt: string;
  gender: 'male' | 'female';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}


export default function AdminPanel() {
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');
  const [currentSettingsTab, setCurrentSettingsTab] = useState<SettingsTab>('general');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeBaseFile[]>([]);
  const [reports, setReports] = useState<SessionReport[]>([]);
  const [openingMessages, setOpeningMessages] = useState<any>({ general: null, lessonMessages: [], lessons: [] });
  const [audioCache, setAudioCache] = useState<any[]>([]);
  const [audioStats, setAudioStats] = useState<any>({ totalFiles: 0, totalSize: 0, cacheHitRate: 0 });
  const [serviceSummary, setServiceSummary] = useState<any>({ serviceDescription: '', keyBenefits: '' });
  const [syncingTranscripts, setSyncingTranscripts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Debug state
  const [debugInfo, setDebugInfo] = useState<any>({
    system: {},
    database: {},
    apis: {},
    sessions: [],
    logs: []
  });
  const [debugLoading, setDebugLoading] = useState(false);
  const [draggedLesson, setDraggedLesson] = useState<string | null>(null);
  const [videoUploadType, setVideoUploadType] = useState<'url' | 'upload'>('url');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadedVideoData, setUploadedVideoData] = useState<{
    videoPath: string;
    videoMimeType: string;
    videoSize: number;
    filename: string;
  } | null>(null);
  
  // YouTube transcript generation state
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    title: string;
    summary: string;
    startMessage: string;
    transcript: string;
    wordCount: number;
    duration: string;
    keyTopics: string[];
  } | null>(null);
  
  // Enhanced field state tracking
  const [fieldStates, setFieldStates] = useState<{
    title: {
      status: 'empty' | 'generated' | 'edited' | 'saved';
      isGenerated: boolean;
      hasUnsavedChanges: boolean;
    };
    videoSummary: {
      status: 'empty' | 'generated' | 'edited' | 'saved';
      isGenerated: boolean;
      hasUnsavedChanges: boolean;
    };
    startMessage: {
      status: 'empty' | 'generated' | 'edited' | 'saved';
      isGenerated: boolean;
      hasUnsavedChanges: boolean;
    };
  }>({
    title: { status: 'empty', isGenerated: false, hasUnsavedChanges: false },
    videoSummary: { status: 'empty', isGenerated: false, hasUnsavedChanges: false },
    startMessage: { status: 'empty', isGenerated: false, hasUnsavedChanges: false }
  });
  
  const [originalGeneratedContent, setOriginalGeneratedContent] = useState({
    title: '',
    videoSummary: '',
    startMessage: ''
  });
  
  const [formData, setFormData] = useState({
    title: '',
    videoUrl: '',
    videoSummary: '',
    startMessage: '',
    prerequisites: '[]'
  });
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [showUploadKnowledgeForm, setShowUploadKnowledgeForm] = useState(false);
  const [hasBaseTemplate, setHasBaseTemplate] = useState(false);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);
  
  // UI Preferences (stored in localStorage, not database)
  const [uiPreferences, setUiPreferences] = useState({
    showEducationalToggle: true,
    showReportsToggle: true,
    showKnowledgeCitations: false
  });

  // Conversation Style Settings
  const [contentPersona, setContentPersona] = useState('default');
  const [personaGender, setPersonaGender] = useState<'male' | 'female'>('female');
  const [customPerson, setCustomPerson] = useState('');

  const [openingMessageFieldStates, setOpeningMessageFieldStates] = useState<{[messageId: string]: {
    status: 'empty' | 'generated' | 'edited' | 'saved';
    isGenerated: boolean;
    hasUnsavedChanges: boolean;
    originalGeneratedContent?: string;
  }}>({});

  // Opening message form data for editing
  const [openingMessageFormData, setOpeningMessageFormData] = useState<{[messageId: string]: string}>({});
  
  // Opening message styling state
  const [isStylingMessage, setIsStylingMessage] = useState<{[messageId: string]: boolean}>({});
  
  // Persona templates
  const personaTemplates = {
    default: {
      name: 'Default',
      description: 'Balanced, professional nutrition education tone',
      prompt: 'You are a knowledgeable nutrition educator providing clear, evidence-based information.'
    },
    friendly: {
      name: 'Friendly Coach',
      description: 'Warm, encouraging, and supportive tone',
      prompt: 'You are a friendly nutrition coach who provides warm, encouraging guidance with a supportive and motivating tone.'
    },
    expert: {
      name: 'Expert Scientist',
      description: 'Technical, research-focused, authoritative tone',
      prompt: 'You are a nutrition scientist providing detailed, research-backed information with technical precision and authority.'
    },
    conversational: {
      name: 'Conversational Guide',
      description: 'Casual, relatable, everyday language',
      prompt: 'You are a knowledgeable friend sharing nutrition insights in casual, everyday language that anyone can understand.'
    },
    motivational: {
      name: 'Motivational Speaker',
      description: 'Inspiring, energetic, goal-focused tone',
      prompt: 'You are an inspiring nutrition coach who motivates people to achieve their health goals with energy and enthusiasm.'
    }
  };
  const baseTemplateInputRef = useRef<HTMLInputElement>(null);

  // Load UI preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('admin_ui_preferences');
    if (saved) {
      try {
        setUiPreferences(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading UI preferences:', error);
      }
    }

    // Load persona settings
    const savedPersona = localStorage.getItem('content_generation_persona');
    if (savedPersona && personaTemplates[savedPersona as keyof typeof personaTemplates]) {
      setContentPersona(savedPersona);
    }
    
    const savedGender = localStorage.getItem('persona_gender');
    if (savedGender === 'male' || savedGender === 'female') {
      setPersonaGender(savedGender);
    }
    
    const savedCustomPerson = localStorage.getItem('custom_person');
    if (savedCustomPerson) {
      setCustomPerson(savedCustomPerson);
    }
  }, []);
  
  // Save UI preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('admin_ui_preferences', JSON.stringify(uiPreferences));
  }, [uiPreferences]);

  // Save conversation style to database when settings change
  const saveConversationStyle = async (basePersona: string, gender: 'male' | 'female', customPerson: string) => {
    try {
      const selectedPersona = personaTemplates[basePersona as keyof typeof personaTemplates];
      let enhancedPrompt = selectedPersona?.prompt || 'You are a knowledgeable nutrition educator providing clear, evidence-based information.';
      
      const genderVoice = gender === 'male' ? 'masculine' : 'feminine';
      enhancedPrompt += ` Write with a ${genderVoice} voice and perspective.`;
      
      if (customPerson.trim()) {
        enhancedPrompt += ` ${customPerson.trim()}.`;
      }
      
      const response = await fetch('/api/admin/conversation-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basePersona,
          gender,
          customPerson,
          enhancedPrompt
        })
      });
      
      if (response.ok) {
        console.log('Conversation style saved to database');
      } else {
        console.error('Failed to save conversation style');
      }
    } catch (error) {
      console.error('Error saving conversation style:', error);
    }
  };


  // Style opening message with LLM
  const styleOpeningMessage = async (messageId: string, userInput: string, messageType: 'general' | 'lesson' = 'general', lessonId?: string) => {
    setIsStylingMessage(prev => ({ ...prev, [messageId]: true }));
    setError(null);

    try {
      const response = await fetch('/api/admin/style-opening-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'style_message',
          messageId,
          userInput,
          messageType,
          lessonId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to style message');
      }

      const data = await response.json();
      
      if (data.success) {
        const styledContent = data.styledContent || data.message?.messageContent || userInput;
        
        // Update the textarea with styled content
        const textarea = document.querySelector('textarea[name="generalMessage"]') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = styledContent;
        }

        // Update form data
        const key = messageType === 'general' ? 'general' : lessonId || '';
        setOpeningMessageFormData(prev => ({
          ...prev,
          [key]: styledContent
        }));
      }
    } catch (error) {
      console.error('Error styling message:', error);
      setError(error instanceof Error ? error.message : 'Failed to style message');
    } finally {
      setIsStylingMessage(prev => ({ ...prev, [messageId]: false }));
    }
  };


  // Handle opening message field changes
  const handleOpeningMessageFieldChange = (messageKey: string, value: string) => {
    setOpeningMessageFormData(prev => ({ ...prev, [messageKey]: value }));
    
    // Update field state
    setOpeningMessageFieldStates(prev => ({
      ...prev,
      [messageKey]: {
        ...prev[messageKey],
        status: value ? (prev[messageKey]?.isGenerated ? 'edited' : 'edited') : 'empty',
        isGenerated: false, // Once edited, no longer purely generated
        hasUnsavedChanges: true
      }
    }));
  };

  // Revert opening message to generated content
  const revertOpeningMessageToGenerated = (messageKey: string) => {
    const fieldState = openingMessageFieldStates[messageKey];
    if (fieldState?.originalGeneratedContent) {
      setOpeningMessageFormData(prev => ({
        ...prev,
        [messageKey]: fieldState.originalGeneratedContent!
      }));
      
      setOpeningMessageFieldStates(prev => ({
        ...prev,
        [messageKey]: {
          ...prev[messageKey],
          status: 'generated',
          isGenerated: true,
          hasUnsavedChanges: true // Still needs to be saved
        }
      }));
    }
  };

  // Get status badge for opening message fields
  const getOpeningMessageStatusBadge = (messageKey: string) => {
    const state = openingMessageFieldStates[messageKey];
    
    if (!state || state.status === 'empty') {
      return null;
    }
    
    if (state.hasUnsavedChanges) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          ⚠️ Unsaved
        </span>
      );
    }
    
    if (state.isGenerated) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          🤖 Generated
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        ✏️ Edited
      </span>
    );
  };

  // Auto-save conversation style when settings change
  useEffect(() => {
    if (contentPersona && personaGender) {
      saveConversationStyle(contentPersona, personaGender, customPerson);
    }
  }, [contentPersona, personaGender, customPerson]);

  // Save service summary
  const saveServiceSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const serviceDescription = formData.get('serviceDescription') as string;
    const keyBenefits = formData.get('keyBenefits') as string;

    try {
      const response = await fetch('/api/admin/service-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceDescription,
          keyBenefits
        })
      });

      if (response.ok) {
        const data = await response.json();
        setServiceSummary(data.summary);
        setError(null);
      } else {
        setError('Failed to save service summary');
      }
    } catch (err) {
      setError('Failed to save service summary');
    }
  };

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Load audio data when the audio tab is selected
  useEffect(() => {
    if (currentTab === 'audio-management') {
      loadAudioData();
    }
  }, [currentTab]);

  // Load debug data when debug tab is selected
  useEffect(() => {
    if (currentTab === 'debug') {
      loadDebugData();
    }
  }, [currentTab]);
  
  // Initialize form data when editing lesson or creating new one
  useEffect(() => {
    if (editingLesson) {
      setFormData({
        title: editingLesson.title,
        videoUrl: editingLesson.videoUrl || '',
        videoSummary: editingLesson.videoSummary,
        startMessage: editingLesson.startMessage || '',
        prerequisites: JSON.stringify(editingLesson.prerequisites || [])
      });
      
      // Set field states based on existing content
      setFieldStates({
        title: {
          status: 'saved',
          isGenerated: false, // We don't know if it was generated, assume edited for existing content
          hasUnsavedChanges: false
        },
        videoSummary: {
          status: 'saved',
          isGenerated: false, // We don't know if it was generated, assume edited for existing content
          hasUnsavedChanges: false
        },
        startMessage: {
          status: editingLesson.startMessage ? 'saved' : 'empty',
          isGenerated: false,
          hasUnsavedChanges: false
        }
      });
    } else if (showLessonForm && !editingLesson) {
      // Reset for new lesson
      setFormData({
        title: '',
        videoUrl: '',
        videoSummary: '',
        startMessage: '',
        prerequisites: '[]'
      });
      
      setFieldStates({
        title: { status: 'empty', isGenerated: false, hasUnsavedChanges: false },
        videoSummary: { status: 'empty', isGenerated: false, hasUnsavedChanges: false },
        startMessage: { status: 'empty', isGenerated: false, hasUnsavedChanges: false }
      });
      
      setOriginalGeneratedContent({
        videoSummary: '',
        startMessage: ''
      });
    }
  }, [editingLesson, showLessonForm]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [lessonsRes, settingsRes, promptsRes, knowledgeRes, reportsRes, templateRes, openingMessagesRes, conversationStyleRes, serviceSummaryRes] = await Promise.all([
        fetch('/api/lessons'),
        fetch('/api/admin/settings'),
        fetch('/api/admin/prompts'),
        fetch('/api/admin/knowledge-base'),
        fetch('/api/reports'),
        fetch('/api/admin/base-template'),
        fetch('/api/admin/opening-messages'),
        fetch('/api/admin/conversation-style'),
        fetch('/api/admin/service-summary')
      ]);

      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json();
        setLessons(lessonsData.lessons || []);
      }


      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData.settings);
      }

      if (promptsRes.ok) {
        const promptsData = await promptsRes.json();
        setPrompts(promptsData.prompts || []);
      }

      if (knowledgeRes.ok) {
        const knowledgeData = await knowledgeRes.json();
        setKnowledgeFiles(knowledgeData.files || []);
      }

      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData.reports || []);
      }

      if (templateRes.ok) {
        const templateData = await templateRes.json();
        setHasBaseTemplate(templateData.hasTemplate || false);
      }

      if (openingMessagesRes.ok) {
        const openingMessagesData = await openingMessagesRes.json();
        setOpeningMessages(openingMessagesData);
      }

      if (conversationStyleRes.ok) {
        const conversationStyleData = await conversationStyleRes.json();
        const settings = conversationStyleData.settings;
        setContentPersona(settings.basePersona);
        setPersonaGender(settings.gender);
        setCustomPerson(settings.customPerson);
      }
      
      if (serviceSummaryRes.ok) {
        const serviceSummaryData = await serviceSummaryRes.json();
        setServiceSummary(serviceSummaryData.summary || { serviceDescription: '', keyBenefits: '' });
      }
    } catch (err) {
      setError('Failed to load admin data');
      console.error('Admin data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };





  // Audio Data Loading Function
  const loadAudioData = async () => {
    try {
      // Get audio cache statistics
      const statsResponse = await fetch('/api/admin/regenerate-audio');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success && statsData.statistics) {
          setAudioStats(statsData.statistics);
        }
      }

      // Get cached audio files (we'll need to create this API endpoint)
      const cacheResponse = await fetch('/api/admin/audio-cache');
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        if (cacheData.success) {
          setAudioCache(cacheData.files || []);
        }
      }
    } catch (err) {
      console.error('Failed to load audio data:', err);
    }
  };

  const loadDebugData = async () => {
    setDebugLoading(true);
    try {
      // Collect debug information from various sources
      const debugData = {
        system: {
          timestamp: new Date().toISOString(),
          nodeVersion: typeof window !== 'undefined' ? 'N/A (client)' : process.version,
          environment: process.env.NODE_ENV || 'unknown',
          platform: typeof navigator !== 'undefined' ? navigator.platform : 'server',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
        },
        database: {},
        apis: {},
        sessions: [],
        logs: []
      };

      // Test key API endpoints
      const apiTests = [
        { name: 'Health Check', endpoint: '/api/health' },
        { name: 'Admin Settings', endpoint: '/api/admin/settings' },
        { name: 'Opening Messages', endpoint: '/api/admin/opening-messages?type=general' },
        { name: 'System Prompts', endpoint: '/api/admin/prompts' },
        { name: 'Knowledge Base', endpoint: '/api/admin/knowledge-base' },
      ];

      const apiResults = {};
      
      for (const test of apiTests) {
        try {
          const startTime = Date.now();
          const response = await fetch(test.endpoint);
          const endTime = Date.now();
          
          apiResults[test.name] = {
            status: response.status,
            responseTime: endTime - startTime,
            ok: response.ok,
            size: response.headers.get('content-length') || 'unknown'
          };
        } catch (error) {
          apiResults[test.name] = {
            status: 'ERROR',
            error: error.message,
            responseTime: null,
            ok: false
          };
        }
      }

      debugData.apis = apiResults;

      // Get recent session data for debugging
      try {
        const sessionsResponse = await fetch('/api/sessions?action=debug&limit=10');
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          debugData.sessions = sessionsData.sessions || [];
        }
      } catch (error) {
        console.error('Failed to load debug sessions:', error);
      }

      // Get database status
      try {
        const dbResponse = await fetch('/api/health');
        if (dbResponse.ok) {
          const dbData = await dbResponse.json();
          debugData.database = {
            status: dbData.database || 'unknown',
            timestamp: dbData.timestamp,
            environment: dbData.environment
          };
        }
      } catch (error) {
        debugData.database = {
          status: 'ERROR',
          error: error.message
        };
      }

      // Add browser/client info
      if (typeof window !== 'undefined') {
        debugData.system.localStorage = Object.keys(localStorage).length;
        debugData.system.sessionStorage = Object.keys(sessionStorage).length;
        debugData.system.cookiesEnabled = navigator.cookieEnabled;
        debugData.system.language = navigator.language;
        debugData.system.onLine = navigator.onLine;
        debugData.system.screen = `${screen.width}x${screen.height}`;
        debugData.system.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }

      // Fetch LLM debug data
      try {
        const llmStatsResponse = await fetch('/api/debug-llm?action=stats');
        if (llmStatsResponse.ok) {
          const llmStatsData = await llmStatsResponse.json();
          debugData.llmStats = llmStatsData.stats;
        }

        const recentEntriesResponse = await fetch('/api/debug-llm?action=entries&limit=10');
        if (recentEntriesResponse.ok) {
          const recentEntriesData = await recentEntriesResponse.json();
          debugData.recentEntries = recentEntriesData.entries;
        }
      } catch (error) {
        console.error('Failed to load LLM debug data:', error);
        debugData.llmStats = { totalEntries: 0, currentSessionEntries: 0, totalSessions: 0 };
        debugData.recentEntries = [];
      }

      setDebugInfo(debugData);
    } catch (error) {
      console.error('Failed to load debug data:', error);
      setError('Failed to load debug information');
    } finally {
      setDebugLoading(false);
    }
  };

  // Field management utility functions
  const handleFieldChange = (fieldName: 'title' | 'videoSummary' | 'startMessage', value: string) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Update field state
    setFieldStates(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        status: value ? (prev[fieldName].isGenerated ? 'edited' : 'edited') : 'empty',
        isGenerated: false, // Once edited, it's no longer purely generated
        hasUnsavedChanges: true
      }
    }));
  };
  
  const handleRevertToGenerated = (fieldName: 'title' | 'videoSummary' | 'startMessage') => {
    const originalContent = originalGeneratedContent[fieldName];
    if (originalContent) {
      setFormData(prev => ({ ...prev, [fieldName]: originalContent }));
      
      // Only update field states for tracked fields (not title)
      if (fieldName !== 'title') {
        setFieldStates(prev => ({
          ...prev,
          [fieldName]: {
            status: 'generated',
            isGenerated: true,
            hasUnsavedChanges: true // Still needs to be saved
          }
        }));
      }
    }
  };
  
  const getFieldStatusBadge = (fieldName: 'title' | 'videoSummary' | 'startMessage') => {
    const state = fieldStates[fieldName];
    
    if (state.status === 'empty') {
      return null;
    }
    
    if (state.hasUnsavedChanges) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          ⚠️ Unsaved
        </span>
      );
    }
    
    if (state.isGenerated) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          🤖 Generated
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        ✏️ Edited
      </span>
    );
  };

  // YouTube Content Generation Handler
  const handleGenerateFromYouTube = async (videoUrl: string, title: string, lessonId?: string) => {
    if (!videoUrl.trim()) {
      setError('Please enter a YouTube URL first');
      return;
    }

    setIsGeneratingContent(true);
    setError(null);

    try {
      console.log('[Admin] Generating content from YouTube URL:', videoUrl);
      
      const selectedPersona = personaTemplates[contentPersona as keyof typeof personaTemplates];
      
      // Build enhanced persona prompt
      let enhancedPrompt = selectedPersona.prompt;
      
      // Add gender specification
      const genderVoice = personaGender === 'male' ? 'masculine' : 'feminine';
      enhancedPrompt += ` Write with a ${genderVoice} voice and perspective.`;
      
      // Add custom person specification if provided
      if (customPerson.trim()) {
        enhancedPrompt += ` ${customPerson.trim()}.`;
      }
      
      const response = await fetch('/api/admin/youtube-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          title: title?.trim() || 'Nutrition Lesson',
          lessonId: lessonId,
          persona: {
            name: `${selectedPersona.name} (${personaGender})${customPerson ? ` - ${customPerson}` : ''}`,
            prompt: enhancedPrompt
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate content');
      }

      // Use AI-generated title from the API response
      const generatedTitle = data.title || title?.trim() || `Nutrition Lesson: ${data.keyTopics?.[0] || 'Health & Wellness'}`;
      
      // Store generated content
      setGeneratedContent({
        summary: data.summary,
        startMessage: data.startMessage,
        transcript: data.transcript,
        wordCount: data.wordCount,
        duration: data.duration,
        keyTopics: data.keyTopics || [],
        title: generatedTitle
      });

      console.log('[Admin] Content generated successfully');
      
      // Store original generated content for revert functionality
      setOriginalGeneratedContent({
        title: generatedTitle,
        videoSummary: data.summary,
        startMessage: data.startMessage
      });
      
      // Update form data with generated content including title
      setFormData(prev => ({
        ...prev,
        title: generatedTitle,
        videoSummary: data.summary,
        startMessage: data.startMessage
      }));
      
      // Auto-save the generated content immediately
      if (lessonId) {
        // Update existing lesson
        try {
          const saveResponse = await fetch('/api/lessons', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update',
              lessonId: lessonId,
              title: generatedTitle,
              videoSummary: data.summary,
              startMessage: data.startMessage,
              videoUrl: videoUrl.trim(),
              videoType: 'url'
            })
          });
          
          if (saveResponse.ok) {
            console.log('[Admin] Generated content auto-saved successfully');
            
            // Mark fields as generated and saved
            setFieldStates({
              title: {
                status: 'saved',
                isGenerated: true,
                hasUnsavedChanges: false
              },
              videoSummary: {
                status: 'saved',
                isGenerated: true,
                hasUnsavedChanges: false
              },
              startMessage: {
                status: 'saved',
                isGenerated: true,
                hasUnsavedChanges: false
              }
            });
            
            // Reload data to reflect changes
            await loadData();
          } else {
            throw new Error('Auto-save failed');
          }
        } catch (autoSaveError) {
          console.warn('[Admin] Auto-save failed:', autoSaveError);
          // Still mark as generated but unsaved on auto-save failure
          setFieldStates({
            title: {
              status: 'generated',
              isGenerated: true,
              hasUnsavedChanges: true
            },
            videoSummary: {
              status: 'generated',
              isGenerated: true,
              hasUnsavedChanges: true
            },
            startMessage: {
              status: 'generated',
              isGenerated: true,
              hasUnsavedChanges: true
            }
          });
        }
      } else {
        // For new lessons, mark as generated (will be saved on Create Lesson)
        setFieldStates({
          title: {
            status: 'generated',
            isGenerated: true,
            hasUnsavedChanges: false // Will auto-save when created
          },
          videoSummary: {
            status: 'generated',
            isGenerated: true,
            hasUnsavedChanges: false // Will auto-save when created
          },
          startMessage: {
            status: 'generated',
            isGenerated: true,
            hasUnsavedChanges: false // Will auto-save when created
          }
        });
      }

    } catch (error) {
      console.error('[Admin] Content generation failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate content from YouTube video');
      setGeneratedContent(null);
    } finally {
      setIsGeneratingContent(false);
    }
  };

  // Video Upload Handler
  const handleVideoUpload = async (file: File) => {
    setUploadingVideo(true);
    try {
      const formData = new FormData();
      formData.append('video', file);
      
      const response = await fetch('/api/admin/upload-video', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const data = await response.json();
      if (data.success) {
        setUploadedVideoData(data);
        setError(null);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Video upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  // Lesson Management Functions
  const createLesson = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const lessonData: any = {
      title: formData.title,
      videoSummary: formData.videoSummary,
      startMessage: formData.startMessage || undefined,
      prerequisites: JSON.parse(formData.prerequisites || '[]'),
      videoType: videoUploadType,
    };

    // Add video source based on type
    if (videoUploadType === 'url') {
      lessonData.videoUrl = formData.videoUrl;
    } else if (videoUploadType === 'upload' && uploadedVideoData) {
      lessonData.videoPath = uploadedVideoData.videoPath;
      lessonData.videoMimeType = uploadedVideoData.videoMimeType;
      lessonData.videoSize = uploadedVideoData.videoSize;
    }
    
    try {
      const response = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...lessonData
        }),
      });

      if (response.ok) {
        await loadData();
        
        // Reset field states to saved
        setFieldStates({
          title: {
            status: 'saved',
            isGenerated: fieldStates.title.isGenerated,
            hasUnsavedChanges: false
          },
          videoSummary: {
            status: 'saved',
            isGenerated: fieldStates.videoSummary.isGenerated,
            hasUnsavedChanges: false
          },
          startMessage: {
            status: 'saved',
            isGenerated: fieldStates.startMessage.isGenerated,
            hasUnsavedChanges: false
          }
        });
        
        // Reset form
        setShowLessonForm(false);
        setGeneratedContent(null);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to create lesson');
      }
    } catch (err) {
      setError('Failed to create lesson');
    }
  };

  const updateLesson = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLesson) return;
    
    const updates: any = {
      title: formData.title,
      videoSummary: formData.videoSummary,
      startMessage: formData.startMessage || undefined,
      prerequisites: JSON.parse(formData.prerequisites || '[]'),
      videoType: videoUploadType,
    };

    // Add video source based on type
    if (videoUploadType === 'url') {
      updates.videoUrl = formData.videoUrl;
      // Clear upload fields when switching to URL
      updates.videoPath = null;
      updates.videoMimeType = null;
      updates.videoSize = null;
    } else if (videoUploadType === 'upload' && uploadedVideoData) {
      updates.videoPath = uploadedVideoData.videoPath;
      updates.videoMimeType = uploadedVideoData.videoMimeType;
      updates.videoSize = uploadedVideoData.videoSize;
      // Clear URL field when switching to upload
      updates.videoUrl = null;
    }
    
    try {
      const response = await fetch('/api/lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          lessonId: editingLesson.id,
          ...updates
        }),
      });

      if (response.ok) {
        // Update field states to 'saved' after successful update
        setFieldStates(prev => ({
          title: {
            ...prev.title,
            status: prev.title.status === 'empty' ? 'empty' : 'saved',
            hasUnsavedChanges: false
          },
          videoSummary: {
            ...prev.videoSummary,
            status: prev.videoSummary.status === 'empty' ? 'empty' : 'saved',
            hasUnsavedChanges: false
          },
          startMessage: {
            ...prev.startMessage,
            status: prev.startMessage.status === 'empty' ? 'empty' : 'saved',
            hasUnsavedChanges: false
          }
        }));
        
        await loadData();
        setEditingLesson(null);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to update lesson');
      }
    } catch (err) {
      setError('Failed to update lesson');
    }
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;

    try {
      const response = await fetch(`/api/lessons?id=${lessonId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadData();
      } else {
        setError('Failed to delete lesson');
      }
    } catch (err) {
      setError('Failed to delete lesson');
    }
  };

  // Lesson drag and drop handlers
  const handleLessonDragStart = (e: React.DragEvent, lessonId: string) => {
    setDraggedLesson(lessonId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleLessonDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (!draggedLesson) return;
    
    const draggedIndex = lessons.findIndex(l => l.id === draggedLesson);
    if (draggedIndex === dropIndex) return;

    // Reorder lessons array
    const newLessons = [...lessons];
    const draggedItem = newLessons.splice(draggedIndex, 1)[0];
    newLessons.splice(dropIndex, 0, draggedItem);

    // Update order indices
    const reorderedIds = newLessons.map(l => l.id);
    
    try {
      const response = await fetch('/api/lessons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder',
          lessonIds: reorderedIds,
        }),
      });

      if (response.ok) {
        await loadData();
      } else {
        setError('Failed to reorder lessons');
      }
    } catch (err) {
      setError('Failed to reorder lessons');
    }
    
    setDraggedLesson(null);
  };

  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  };


  // System Prompt Management

  const updateSystemPrompt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPrompt) return;

    const formData = new FormData(e.currentTarget);
    const file = formData.get('file') as File;
    
    try {
      let content = editingPrompt.content; // Keep existing content if no file
      if (file) {
        content = await file.text();
      }

      const response = await fetch('/api/admin/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptId: editingPrompt.id,
          content,
        }),
      });

      if (response.ok) {
        await loadData();
        setEditingPrompt(null);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to update system prompt');
      }
    } catch (err) {
      setError('Failed to update system prompt');
    }
  };


  // Preview system prompt in new window
  const previewSystemPrompt = (prompt: SystemPrompt) => {
    const content = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${prompt.type.toUpperCase()} System Prompt</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
            color: #333;
            background-color: #fff;
        }
        .header {
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }
        h1 {
            color: #1f2937;
            margin: 0;
            font-size: 2rem;
            font-weight: 600;
        }
        .type-badge {
            display: inline-block;
            background-color: #3b82f6;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.875rem;
            font-weight: 500;
            text-transform: uppercase;
            margin-top: 0.5rem;
        }
        .meta {
            color: #6b7280;
            font-size: 0.875rem;
            margin-top: 0.5rem;
        }
        .content {
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 2rem;
            margin-bottom: 2rem;
            white-space: pre-wrap;
            line-height: 1.8;
            font-size: 1rem;
        }
        .actions {
            display: flex;
            gap: 1rem;
            margin-top: 2rem;
        }
        button {
            background-color: #3b82f6;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            font-weight: 500;
        }
        button:hover {
            background-color: #2563eb;
        }
        .export-btn {
            background-color: #059669;
        }
        .export-btn:hover {
            background-color: #047857;
        }
        .close-btn {
            background-color: #6b7280;
        }
        .close-btn:hover {
            background-color: #4b5563;
        }
        @media print {
            .actions { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>System Prompt</h1>
        <div class="type-badge">${prompt.type}</div>
        <div class="meta">
            Created: ${new Date(prompt.createdAt).toLocaleDateString()} | 
            Updated: ${new Date(prompt.updatedAt).toLocaleDateString()} |
            Status: ${prompt.active ? 'Active' : 'Inactive'}
        </div>
    </div>
    
    <div class="content">${prompt.content}</div>
    
    <div class="actions">
        <button onclick="window.print()">Print</button>
        <button class="export-btn" onclick="exportPrompt()">Export as Text</button>
        <button class="close-btn" onclick="window.close()">Close Window</button>
    </div>
    
    <script>
        function exportPrompt() {
            const content = \`${prompt.content}\`;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '${prompt.type}_system_prompt.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    </script>
</body>
</html>`;
    
    const newWindow = window.open('', '_blank', 'width=1000,height=800,scrollbars=yes,resizable=yes');
    if (newWindow) {
      newWindow.document.write(content);
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups for this site to preview prompts in new windows');
    }
  };

  // Export system prompt
  const exportSystemPrompt = (prompt: SystemPrompt) => {
    const content = prompt.content;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prompt.type}_system_prompt.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Create new lesson-specific prompt
  const createLessonPrompt = async (lessonId: string) => {
    try {
      const lesson = lessons.find(l => l.id === lessonId);
      const defaultContent = `You are Sanjay, an AI financial advisor discussing "${lesson?.title || 'this lesson'}" with the user.

Based on the lesson video about ${lesson?.title || 'financial concepts'}, help the user:
- Apply the concepts to their personal situation
- Understand how this relates to their financial goals
- Ask clarifying questions to deepen understanding
- Connect this lesson to broader financial planning

Remember to:
- Reference the specific lesson content when relevant
- Maintain a warm, supportive tone
- Provide practical, actionable advice
- Help them see real-world applications

The lesson context and video summary will be automatically added to this prompt when used.`;

      const response = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'lesson_qa',
          content: defaultContent,
          lessonId: lessonId
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPrompts(prev => [...prev, data.prompt]);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create lesson prompt');
      }
    } catch (error) {
      console.error('Error creating lesson prompt:', error);
      setError('Failed to create lesson prompt');
    }
  };

  // Create new system prompt
  const createNewPrompt = async (type: string) => {
    try {
      const defaultContent = type === 'qa' 
        ? `You are Sanjay, a warm, empathetic AI financial advisor who specializes in helping people develop healthy relationships with money.

Your approach:
- Listen actively and ask thoughtful follow-up questions
- Provide practical, actionable advice
- Help clients identify emotional patterns around money
- Offer personalized strategies for financial wellness
- Maintain a supportive, non-judgmental tone
- Focus on behavioral change and sustainable habits

Keep responses conversational, warm, and focused on the human experience of financial decision-making.`
        : `You are Sanjay, an AI financial advisor discussing a specific lesson with the user. Use the lesson context provided to give informed, relevant responses.

Guidelines:
- Reference the lesson content when relevant
- Help users apply lesson concepts to their specific situation
- Encourage questions that deepen understanding
- Connect lesson concepts to real-world financial decisions
- Maintain the same warm, supportive tone as general conversations

The lesson context will be automatically added to this prompt when used.`;

      const response = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content: defaultContent
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPrompts(prev => [...prev, data.prompt]);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create prompt');
      }
    } catch (error) {
      console.error('Error creating prompt:', error);
      setError('Failed to create prompt');
    }
  };

  // Report Management Functions
  const downloadReport = async (reportId: string, sessionId: string) => {
    try {
      const response = await fetch(`/api/reports?reportId=${reportId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-report-${sessionId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError('Failed to download report');
      }
    } catch (err) {
      setError('Failed to download report');
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          reportId
        })
      });

      if (response.ok) {
        await loadData();
      } else {
        setError('Failed to delete report');
      }
    } catch (err) {
      setError('Failed to delete report');
    }
  };

  // Knowledge Base Management
  const uploadKnowledgeFile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch('/api/admin/knowledge-base', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadData();
        setShowUploadKnowledgeForm(false);
        (e.target as HTMLFormElement).reset();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to upload knowledge base file');
      }
    } catch (err) {
      setError('Failed to upload knowledge base file');
    }
  };

  const deleteKnowledgeFile = async (fileId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      const response = await fetch(`/api/admin/knowledge-base?id=${fileId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadData();
      } else {
        setError('Failed to delete knowledge base file');
      }
    } catch (err) {
      setError('Failed to delete knowledge base file');
    }
  };

  // Base Template Management
  const uploadBaseTemplate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append('action', 'upload');

    try {
      const response = await fetch('/api/admin/base-template', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadData();
        (e.target as HTMLFormElement).reset();
        alert('Base report template uploaded successfully!');
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to upload template');
      }
    } catch (err) {
      setError('Failed to upload base template');
    }
  };

  const removeBaseTemplate = async () => {
    if (!confirm('Are you sure you want to remove the base report template?')) return;

    try {
      const formData = new FormData();
      formData.append('action', 'remove');

      const response = await fetch('/api/admin/base-template', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadData();
        alert('Base report template removed successfully!');
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to remove template');
      }
    } catch (err) {
      setError('Failed to remove base template');
    }
  };

  // Settings Management
  const updateSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const updates = {
      voiceId: formData.get('voiceId') as string,
      voiceDescription: formData.get('voiceDescription') as string,
      personalizationEnabled: formData.has('personalizationEnabled'),
      conversationAware: formData.has('conversationAware'),
      debugLlmEnabled: formData.has('debugLlmEnabled'),
    };

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await loadData();
        alert('Settings updated successfully!');
      }
    } catch (err) {
      setError('Failed to update settings');
    }
  };

  const updateUISettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Handle database settings
    const dbUpdates: any = {};
    dbUpdates.useStructuredConversation = formData.has('useStructuredConversation');
    
    // Handle UI preferences (localStorage)
    const newUiPreferences = {
      showEducationalToggle: formData.has('showEducationalToggle'),
      showReportsToggle: formData.has('showReportsToggle'),
      showKnowledgeCitations: formData.has('showKnowledgeCitations')
    };
    
    try {
      // Update database settings
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbUpdates),
      });

      if (response.ok) {
        // Update UI preferences
        setUiPreferences(newUiPreferences);
        await loadData();
        alert('UI Settings updated successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to update UI settings: ${error.error}`);
      }
    } catch (err) {
      setError('Failed to update UI settings');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AppHeader />
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
            </div>
            <div className="text-sm text-gray-500">
              Educational Content Management
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Main Content Area with Sidebar */}
        <div className="flex gap-8">
          {/* Side Panel Navigation */}
          <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-200 h-fit">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Admin Panel</h3>
              <p className="text-sm text-gray-500">Manage educational content & monitoring</p>
            </div>
            <nav className="p-4 space-y-2">
              {[
                { id: 'overview', label: 'Overview', icon: Home },
                { id: 'lessons', label: 'Lessons', icon: FileText, count: lessons.length },
                { id: 'prompts', label: 'System Prompts', icon: Database, count: prompts.length },
                { id: 'knowledge', label: 'Knowledge Base', icon: Upload, count: knowledgeFiles.length },
                { id: 'opening-messages', label: 'Opening Messages', icon: MessageSquare },
                { id: 'audio-management', label: 'Audio Management', icon: Volume2, count: audioCache.length },
                { id: 'reports', label: 'Report Template', icon: BarChart3, count: hasBaseTemplate ? 1 : 0 },
                { id: 'debug', label: 'Debug & Monitor', icon: AlertTriangle },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map(({ id, label, icon: Icon, count }) => (
                <button
                  key={id}
                  onClick={() => setCurrentTab(id as AdminTab)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors text-left ${
                    currentTab === id
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{label}</span>
                  {count !== undefined && (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      currentTab === id ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200">
          {currentTab === 'overview' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Overview</h2>
              
              {/* Service Summary */}
              <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Summary</h3>
                <p className="text-sm text-gray-700 mb-4">
                  Describe what your service offers and how it helps clients. This summary will be used throughout the application and in opening messages.
                </p>
                <form onSubmit={saveServiceSummary} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Description (10-20 lines)
                    </label>
                    <textarea
                      name="serviceDescription"
                      rows={12}
                      defaultValue={serviceSummary.serviceDescription}
                      placeholder="We provide comprehensive nutrition education and counseling services designed to help individuals achieve their health and wellness goals. Our AI-powered platform combines evidence-based nutrition science with personalized guidance to create effective, sustainable dietary changes.

Our services include:
- Personalized nutrition assessments and planning
- Interactive educational modules covering key nutrition topics  
- One-on-one AI consultations for specific dietary questions
- Evidence-based meal planning and recipe recommendations
- Ongoing support and progress tracking

Whether you're looking to lose weight, manage a health condition, improve athletic performance, or simply eat healthier, our comprehensive approach ensures you receive the knowledge and tools needed for long-term success.

Our certified nutrition professionals have developed this platform to make quality nutrition guidance accessible, affordable, and convenient for everyone."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      This description will be used in opening messages and throughout the platform to explain your services.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Key Benefits (one per line)
                    </label>
                    <textarea
                      name="keyBenefits"
                      rows={6}
                      defaultValue={serviceSummary.keyBenefits}
                      placeholder="Evidence-based nutrition guidance
Personalized meal planning and recommendations  
Interactive learning modules with expert instruction
24/7 AI support for nutrition questions
Progress tracking and goal setting tools
Affordable alternative to traditional nutrition counseling"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      List the main benefits clients receive from your service.
                    </p>
                  </div>
                  
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium"
                  >
                    Save Service Summary
                  </button>
                </form>
              </div>

              {/* Service Provider Information */}
              <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">Service Provider Information</h3>
                <p className="text-sm text-blue-700 mb-4">
                  This information drives the opening messages and website branding.
                </p>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        Business Name
                      </label>
                      <input
                        type="text"
                        placeholder="Your Business Name"
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        placeholder="(555) 123-4567"
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Address
                    </label>
                    <textarea
                      rows={2}
                      placeholder="123 Main Street, City, State 12345"
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="contact@yourbusiness.com"
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800 mb-1">
                        Website (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="www.yourbusiness.com"
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    Save Service Provider Info
                  </button>
                </form>
              </div>

              {/* Website Configuration */}
              <div className="mb-8 p-6 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-4">Website Configuration</h3>
                <p className="text-sm text-green-700 mb-4">
                  Customize what your educational content is called and how it's described.
                </p>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-800 mb-1">
                        What are your lessons called?
                      </label>
                      <input
                        type="text"
                        defaultValue="Lessons"
                        placeholder="e.g., Modules, Sessions, Courses"
                        className="w-full px-3 py-2 border border-green-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-green-800 mb-1">
                        What does open conversation cover?
                      </label>
                      <input
                        type="text"
                        defaultValue="Chat"
                        placeholder="e.g., Q&A, Discussion, Consultation"
                        className="w-full px-3 py-2 border border-green-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-green-800 mb-1">
                        Lesson Description
                      </label>
                      <input
                        type="text"
                        defaultValue="Educational video content"
                        placeholder="Brief description of your lessons"
                        className="w-full px-3 py-2 border border-green-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-green-800 mb-1">
                        Conversation Description
                      </label>
                      <input
                        type="text"
                        defaultValue="Open conversation with AI"
                        placeholder="Brief description of conversations"
                        className="w-full px-3 py-2 border border-green-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                  >
                    Save Website Config
                  </button>
                </form>
              </div>

              {/* Conversation Style & Voice Settings */}
              <div className="p-6 bg-purple-50 rounded-lg border border-purple-200">
                <h3 className="text-lg font-semibold text-purple-900 mb-4">Conversation Style & Voice</h3>
                <p className="text-sm text-purple-700 mb-4">
                  Configure the personality and voice characteristics for AI conversations.
                </p>
                
                {/* Persona Style Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-purple-800 mb-2">Base Style</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(personaTemplates).map(([key, persona]) => (
                      <div key={key} className="relative">
                        <input
                          type="radio"
                          id={`persona-${key}`}
                          name="content-persona"
                          value={key}
                          checked={contentPersona === key}
                          onChange={(e) => setContentPersona(e.target.value)}
                          className="sr-only"
                        />
                        <label
                          htmlFor={`persona-${key}`}
                          className={`block p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            contentPersona === key
                              ? 'border-purple-500 bg-purple-100 ring-2 ring-purple-200'
                              : 'border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50'
                          }`}
                        >
                          <div className="font-medium text-sm text-gray-900 mb-1">
                            {persona.name}
                          </div>
                          <div className="text-xs text-gray-600">
                            {persona.description}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Gender and Custom Person Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Gender Selection */}
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-2">Voice Gender</label>
                    <div className="flex gap-3">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="persona-gender"
                          value="female"
                          checked={personaGender === 'female'}
                          onChange={(e) => setPersonaGender(e.target.value as 'male' | 'female')}
                          className="mr-2 text-purple-600"
                        />
                        <span className="text-sm text-gray-700">Female</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="persona-gender"
                          value="male"
                          checked={personaGender === 'male'}
                          onChange={(e) => setPersonaGender(e.target.value as 'male' | 'female')}
                          className="mr-2 text-purple-600"
                        />
                        <span className="text-sm text-gray-700">Male</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Custom Person Field */}
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-2">
                      Custom Personality (Optional)
                    </label>
                    <input
                      type="text"
                      value={customPerson}
                      onChange={(e) => setCustomPerson(e.target.value)}
                      placeholder="e.g., like Norah Ephron with references to Manhattan"
                      className="w-full px-3 py-2 text-sm border border-purple-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
                
                {/* Voice Settings from Settings Tab */}
                <div className="border-t border-purple-200 pt-4">
                  <h4 className="text-sm font-medium text-purple-800 mb-3">Voice Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">
                        ElevenLabs Voice ID
                      </label>
                      <input
                        type="text"
                        name="voiceId"
                        defaultValue={settings?.voiceId || ''}
                        className="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        placeholder="e.g., pNInz6obpgDQGcFmaJgB"
                      />
                      <p className="mt-1 text-xs text-purple-600">
                        The ElevenLabs voice ID to use for all audio generation
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-purple-800 mb-1">
                        Voice Characteristics
                      </label>
                      <textarea
                        name="voiceDescription"
                        rows={2}
                        defaultValue={settings?.voiceDescription || ''}
                        className="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        placeholder="e.g., Make voice deeper and slower, less nasal"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-purple-100 rounded-md">
                  <p className="text-xs text-purple-700">
                    <strong>Current Style:</strong> {personaTemplates[contentPersona as keyof typeof personaTemplates].name} • 
                    <strong> Gender:</strong> {personaGender === 'male' ? 'Male' : 'Female'} voice
                    {customPerson && <> • <strong>Custom:</strong> {customPerson}</>}
                  </p>
                </div>
                
                <button
                  type="button"
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                >
                  Save Style & Voice Settings
                </button>
              </div>
            </div>
          )}
          {currentTab === 'lessons' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Lessons</h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {lessons.length} lessons
                  </span>
                  <button
                    onClick={() => setShowLessonForm(!showLessonForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {showLessonForm ? 'Cancel' : 'Create New Lesson'}
                  </button>
                </div>
              </div>


              {/* Create/Edit Lesson Form */}
              {(showLessonForm || editingLesson) && (
                <form onSubmit={editingLesson ? updateLesson : createLesson} className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-medium mb-4">
                    {editingLesson ? 'Edit Lesson' : 'Create New Lesson'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Lesson Title
                        </label>
                        {originalGeneratedContent.title && (
                          <button
                            type="button"
                            onClick={() => handleRevertToGenerated('title')}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                          >
                            Revert
                          </button>
                        )}
                        {getFieldStatusBadge('title')}
                      </div>
                      <input
                        type="text"
                        name="title"
                        required
                        value={formData.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Introduction to Retirement Planning"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Video Source
                      </label>
                      <div className="mb-4">
                        <div className="flex gap-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="videoSource"
                              value="url"
                              checked={videoUploadType === 'url'}
                              onChange={() => {
                                setVideoUploadType('url');
                                setUploadedVideoData(null);
                              }}
                              className="mr-2"
                            />
                            Video URL
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="videoSource"
                              value="upload"
                              checked={videoUploadType === 'upload'}
                              onChange={() => {
                                setVideoUploadType('upload');
                              }}
                              className="mr-2"
                            />
                            Upload Video
                          </label>
                        </div>
                      </div>

                      {videoUploadType === 'url' && (
                        <div>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              name="videoUrl"
                              id="videoUrl"
                              required={videoUploadType === 'url'}
                              value={formData.videoUrl}
                              onChange={(e) => setFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              placeholder="https://www.youtube.com/watch?v=..."
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleGenerateFromYouTube(
                                  formData.videoUrl || '', 
                                  formData.title || '',
                                  editingLesson?.id
                                );
                              }}
                              disabled={isGeneratingContent}
                              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-md hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[140px] justify-center transition-all duration-200"
                            >
                              {isGeneratingContent ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  <span>Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" />
                                  <span>Auto-Generate</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            YouTube URL for this lesson. Click "Auto-Generate" to extract transcript and create summary & intro.
                          </p>
                          
                          {/* Generated Content Display */}
                          {generatedContent && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-sm font-medium text-green-800">
                                  Content Generated Successfully
                                </span>
                                <span className="text-xs text-green-600">
                                  ({generatedContent.wordCount} words, {generatedContent.duration})
                                </span>
                              </div>
                              
                              {generatedContent.keyTopics.length > 0 && (
                                <div className="mb-3">
                                  <span className="text-xs font-medium text-green-700">Key Topics: </span>
                                  <span className="text-xs text-green-600">
                                    {generatedContent.keyTopics.join(', ')}
                                  </span>
                                </div>
                              )}
                              
                              <p className="text-xs text-green-700">
                                ✓ Summary and start message have been automatically filled in the form below.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {videoUploadType === 'upload' && (
                        <div>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/mov,video/avi"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleVideoUpload(file);
                                }
                              }}
                              className="hidden"
                              id="video-upload"
                              disabled={uploadingVideo}
                            />
                            <label
                              htmlFor="video-upload"
                              className={`cursor-pointer flex flex-col items-center ${uploadingVideo ? 'opacity-50' : ''}`}
                            >
                              <Upload className="w-12 h-12 text-gray-400 mb-4" />
                              {uploadingVideo ? (
                                <p className="text-sm text-gray-600">Uploading...</p>
                              ) : (
                                <>
                                  <p className="text-sm text-gray-600 mb-2">
                                    Click to upload video or drag and drop
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    MP4, WebM, MOV, AVI up to 100MB
                                  </p>
                                </>
                              )}
                            </label>
                          </div>
                          
                          {uploadedVideoData && (
                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                              <p className="text-sm text-green-800">
                                ✓ Video uploaded: {uploadedVideoData.filename}
                              </p>
                              <p className="text-xs text-green-600">
                                Size: {(uploadedVideoData.videoSize / 1024 / 1024).toFixed(1)}MB
                              </p>
                            </div>
                          )}

                          {!uploadedVideoData && videoUploadType === 'upload' && (
                            <p className="mt-2 text-sm text-red-500">
                              Please upload a video file before saving the lesson.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Video Summary (for LLM Context)
                        </label>
                        {getFieldStatusBadge('videoSummary')}
                        {fieldStates.videoSummary.isGenerated && (
                          <button
                            type="button"
                            onClick={() => handleRevertToGenerated('videoSummary')}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                          >
                            Revert
                          </button>
                        )}
                      </div>
                      <textarea
                        name="videoSummary"
                        required
                        rows={4}
                        value={formData.videoSummary}
                        onChange={(e) => handleFieldChange('videoSummary', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Summarize the key concepts covered in this video for the AI to use during Q&A..."
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        This summary helps the AI provide contextual responses during Q&A
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Start Message (TTS Introduction)
                        </label>
                        {getFieldStatusBadge('startMessage')}
                        {fieldStates.startMessage.isGenerated && (
                          <button
                            type="button"
                            onClick={() => handleRevertToGenerated('startMessage')}
                            className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                          >
                            Revert
                          </button>
                        )}
                      </div>
                      <textarea
                        name="startMessage"
                        rows={3}
                        value={formData.startMessage}
                        onChange={(e) => handleFieldChange('startMessage', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Welcome to this lesson on retirement planning. Before we watch the video, let me introduce what you'll be learning today..."
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Optional message played via TTS before the video starts (leave empty to skip)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prerequisites (JSON Array)
                      </label>
                      <textarea
                        name="prerequisites"
                        rows={2}
                        value={formData.prerequisites}
                        onChange={(e) => setFormData(prev => ({ ...prev, prerequisites: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder='["lesson_id_1", "lesson_id_2"]'
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Lesson IDs that must be completed before this lesson (JSON format)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Save className="w-4 h-4" />
                      {editingLesson ? 'Update Lesson' : 'Create Lesson'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLessonForm(false);
                        setEditingLesson(null);
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Lessons List with Drag & Drop */}
              <div className="space-y-4">
                {lessons.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">No lessons created yet</p>
                    <p className="text-sm">Create your first lesson above to get started with the video-based learning system.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lessons.map((lesson, index) => (
                      <div
                        key={lesson.id}
                        draggable
                        onDragStart={(e) => handleLessonDragStart(e, lesson.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleLessonDrop(e, index)}
                        className={`border-2 rounded-lg p-4 transition-all cursor-move ${
                          draggedLesson === lesson.id
                            ? 'border-blue-400 bg-blue-50 shadow-lg scale-105'
                            : 'border-gray-200 bg-white hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Drag Handle */}
                          <div className="flex items-center gap-2 pt-1">
                            <GripVertical className="w-5 h-5 text-gray-400" />
                            <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              #{index + 1}
                            </span>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {lesson.title}
                              </h3>
                              <a
                                href={lesson.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                View Video →
                              </a>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4 mb-3">
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Video URL:</span> {lesson.videoUrl.substring(0, 50)}...
                              </div>
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">Created:</span> {new Date(lesson.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            
                            {/* Video Summary */}
                            <div className="bg-green-50 rounded-md p-3 mb-3">
                              <p className="text-sm font-medium text-green-700 mb-1">Video Summary:</p>
                              <p className="text-green-900 text-sm leading-relaxed">
                                {lesson.videoSummary.length > 200 
                                  ? lesson.videoSummary.substring(0, 200) + '...'
                                  : lesson.videoSummary
                                }
                              </p>
                            </div>

                            {/* Start Message */}
                            {lesson.startMessage && (
                              <div className="bg-blue-50 rounded-md p-3 mb-3">
                                <p className="text-sm font-medium text-blue-700 mb-1">TTS Introduction:</p>
                                <p className="text-blue-900 text-sm leading-relaxed">
                                  {lesson.startMessage.length > 150 
                                    ? lesson.startMessage.substring(0, 150) + '...'
                                    : lesson.startMessage
                                  }
                                </p>
                              </div>
                            )}

                            {/* Prerequisites */}
                            {lesson.prerequisites.length > 0 && (
                              <div className="bg-amber-50 rounded-md p-3">
                                <p className="text-sm font-medium text-amber-700 mb-1">Prerequisites:</p>
                                <div className="flex flex-wrap gap-1">
                                  {lesson.prerequisites.map((prereqId, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs">
                                      {prereqId}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingLesson(lesson)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="Edit lesson"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteLesson(lesson.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete lesson"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


          {currentTab === 'settings' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">System Settings</h2>
              
              {/* Settings Sub-tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { id: 'general', name: 'General', icon: Settings },
                    { id: 'ui', name: 'UI Settings', icon: Settings }
                  ].map(({ id, name, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setCurrentSettingsTab(id as SettingsTab)}
                      className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                        currentSettingsTab === id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* General Settings */}
              {currentSettingsTab === 'general' && (
                <form onSubmit={updateSettings} className="max-w-2xl space-y-6">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="personalizationEnabled"
                      name="personalizationEnabled"
                      defaultChecked={settings?.personalizationEnabled || false}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="personalizationEnabled" className="ml-2 block text-sm text-gray-900">
                      Enable personalization by default
                    </label>
                  </div>
                  <p className="text-sm text-gray-500">
                    When enabled, the system will use full conversation history to personalize responses and content
                  </p>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="conversationAware"
                      name="conversationAware"
                      defaultChecked={settings?.conversationAware !== false}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="conversationAware" className="ml-2 block text-sm text-gray-900">
                      Enable conversation awareness by default
                    </label>
                  </div>
                  <p className="text-sm text-gray-500">
                    When enabled, the system will generate smooth transitions between educational content chunks based on conversation history
                  </p>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="debugLlmEnabled"
                      name="debugLlmEnabled"
                      defaultChecked={settings?.debugLlmEnabled || false}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="debugLlmEnabled" className="ml-2 block text-sm text-gray-900">
                      Enable LLM Debug Capture
                    </label>
                  </div>
                  <p className="text-sm text-gray-500">
                    When enabled, the system will capture and monitor all LLM interactions for debugging and analysis
                  </p>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    <Save className="w-4 h-4" />
                    Save General Settings
                  </button>
                </form>
              )}


              {/* UI Settings */}
              {currentSettingsTab === 'ui' && (
                <form onSubmit={updateUISettings} className="max-w-2xl space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Educational Content Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="useStructuredConversation"
                          name="useStructuredConversation"
                          defaultChecked={settings?.useStructuredConversation ?? true}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="useStructuredConversation" className="ml-2 block text-sm text-gray-900">
                          <span className="font-medium">Use Structured Conversation (Chunks)</span>
                          <div className="text-xs text-gray-500 mt-1">
                            When enabled, uses structured conversation with chunks. When disabled, allows open-ended conversation.
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Interface Toggles</h3>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="showEducationalToggle"
                          name="showEducationalToggle"
                          defaultChecked={uiPreferences.showEducationalToggle}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="showEducationalToggle" className="ml-2 block text-sm text-gray-900">
                          Show Educational Mode toggle in interface
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="showReportsToggle"
                          name="showReportsToggle"
                          defaultChecked={uiPreferences.showReportsToggle}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="showReportsToggle" className="ml-2 block text-sm text-gray-900">
                          Show Reports Generation toggle in interface
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="showKnowledgeCitations"
                          name="showKnowledgeCitations"
                          defaultChecked={uiPreferences.showKnowledgeCitations}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="showKnowledgeCitations" className="ml-2 block text-sm text-gray-900">
                          Show knowledge base citations in responses
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Interface Behavior</h3>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="autoScrollEnabled"
                          name="autoScrollEnabled"
                          defaultChecked={true}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="autoScrollEnabled" className="ml-2 block text-sm text-gray-900">
                          Auto-scroll during conversations
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="showProgressIndicators"
                          name="showProgressIndicators"
                          defaultChecked={true}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="showProgressIndicators" className="ml-2 block text-sm text-gray-900">
                          Show session progress indicators
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="enableChunkProgression"
                          name="enableChunkProgression"
                          defaultChecked={true}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="enableChunkProgression" className="ml-2 block text-sm text-gray-900">
                          Enable visual chunk progression in educational mode
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Response Timing
                    </label>
                    <input
                      type="number"
                      name="responseDelayMs"
                      defaultValue={500}
                      min={0}
                      max={3000}
                      step={100}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-500">milliseconds delay</span>
                    <p className="mt-1 text-sm text-gray-500">
                      Delay before showing AI responses to improve perceived naturalness
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    <Save className="w-4 h-4" />
                    Save UI Settings
                  </button>
                </form>
              )}

            </div>
          )}

          {currentTab === 'prompts' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">System Prompts</h2>
                <div className="text-sm text-gray-500">
                  {prompts.length} prompt types configured
                </div>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Lesson-Based System:</span> Configure the General Q&A prompt for open conversations, plus individual Q&A prompts for each lesson.
                </p>
              </div>
              
              {/* General QA Prompt */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">General Q&A Prompt</h3>
                {(() => {
                  const prompt = prompts.find(p => p.type === 'qa' && !p.lessonId);
                  return (
                    <div className="border border-gray-200 rounded-lg">
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-base font-medium text-gray-900">
                              General Financial Conversations
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Used for introduction sessions and open financial discussions
                            </p>
                          </div>
                          {prompt && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => previewSystemPrompt(prompt)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Open in new window"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingPrompt(prompt)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Edit prompt"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => exportSystemPrompt(prompt)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                title="Export as file"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        {prompt ? (
                          editingPrompt?.id === prompt.id ? (
                            // Edit Form
                            <form onSubmit={updateSystemPrompt} className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Text File (optional - leave empty to keep current content)
                                </label>
                                <input
                                  type="file"
                                  name="file"
                                  accept=".txt,.md"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="mt-1 text-sm text-gray-500">
                                  Upload a text file to replace the current system prompt content
                                </p>
                              </div>
                              <div className="bg-gray-50 p-4 rounded-md">
                                <p className="text-sm font-medium text-gray-700 mb-2">Current content preview:</p>
                                <pre className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                                  {prompt.content.substring(0, 200)}
                                  {prompt.content.length > 200 && '...'}
                                </pre>
                              </div>
                              <div className="flex gap-3">
                                <button
                                  type="submit"
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                  <Save className="w-4 h-4" />
                                  Save Changes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPrompt(null)}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            // Display Mode
                            <div>
                              <div className="grid md:grid-cols-2 gap-4 mb-3">
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Content:</span> {prompt.content.length} characters
                                </div>
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Updated:</span> {new Date(prompt.updatedAt).toLocaleDateString()}
                                </div>
                              </div>
                              
                              {/* Content Preview */}
                              <div className="bg-gray-50 p-4 rounded-md">
                                <div className="mb-2">
                                  <p className="text-sm font-medium text-gray-700">Preview:</p>
                                </div>
                                <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                  {prompt.content.substring(0, 300)}
                                  {prompt.content.length > 300 && '...'}
                                </pre>
                                {prompt.content.length > 300 && (
                                  <div className="mt-2 text-center">
                                    <button
                                      onClick={() => previewSystemPrompt(prompt)}
                                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      Click to view full content →
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="text-lg mb-2">No General Q&A prompt found</p>
                            <p className="text-sm mb-4">Create a new prompt to enable this functionality.</p>
                            <button
                              onClick={() => createNewPrompt('qa')}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mx-auto"
                            >
                              <Plus className="w-4 h-4" />
                              Create General Q&A Prompt
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Report Prompt */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Prompt</h3>
                {(() => {
                  const prompt = prompts.find(p => p.type === 'report');
                  return (
                    <div className="border border-gray-200 rounded-lg">
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-base font-medium text-gray-900">
                              Session Summary Reports
                            </h4>
                            <p className="text-sm text-gray-500 mt-1">
                              Used for generating comprehensive session summaries and insights
                            </p>
                          </div>
                          {prompt && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => previewSystemPrompt(prompt)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Open in new window"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingPrompt(prompt)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Edit prompt"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => exportSystemPrompt(prompt)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                title="Export as file"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-4">
                        {prompt ? (
                          editingPrompt?.id === prompt.id ? (
                            // Edit Form
                            <form onSubmit={updateSystemPrompt} className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Text File (optional - leave empty to keep current content)
                                </label>
                                <input
                                  type="file"
                                  name="file"
                                  accept=".txt,.md"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                                <p className="mt-1 text-sm text-gray-500">
                                  Upload a text file to replace the current report prompt content
                                </p>
                              </div>
                              <div className="bg-gray-50 p-4 rounded-md">
                                <p className="text-sm font-medium text-gray-700 mb-2">Current content preview:</p>
                                <pre className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                                  {prompt.content.substring(0, 200)}
                                  {prompt.content.length > 200 && '...'}
                                </pre>
                              </div>
                              <div className="flex gap-3">
                                <button
                                  type="submit"
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                  <Save className="w-4 h-4" />
                                  Save Changes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingPrompt(null)}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            // Display Mode
                            <div>
                              <div className="grid md:grid-cols-2 gap-4 mb-3">
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Content:</span> {prompt.content.length} characters
                                </div>
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Updated:</span> {new Date(prompt.updatedAt).toLocaleDateString()}
                                </div>
                              </div>
                              
                              {/* Content Preview */}
                              <div className="bg-gray-50 p-4 rounded-md">
                                <div className="mb-2">
                                  <p className="text-sm font-medium text-gray-700">Preview:</p>
                                </div>
                                <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                  {prompt.content.substring(0, 300)}
                                  {prompt.content.length > 300 && '...'}
                                </pre>
                                {prompt.content.length > 300 && (
                                  <div className="mt-2 text-center">
                                    <button
                                      onClick={() => previewSystemPrompt(prompt)}
                                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      Click to view full content →
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
                            <p className="text-lg mb-2">No Report prompt found</p>
                            <p className="text-sm mb-4">Create a new prompt to enable session report generation.</p>
                            <button
                              onClick={() => createNewPrompt('report')}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mx-auto"
                            >
                              <Plus className="w-4 h-4" />
                              Create Report Prompt
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Lesson-Specific Prompts */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lesson Q&A Prompts</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Each lesson can have its own customized Q&A prompt. These prompts are combined with lesson context during Q&A sessions.
                </p>
                
                {lessons.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg mb-2">No lessons found</p>
                    <p className="text-sm">Create lessons first to manage lesson-specific prompts.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lessons.map((lesson) => {
                      const lessonPrompt = prompts.find(p => p.type === 'lesson_qa' && p.lessonId === lesson.id);
                      return (
                        <div key={lesson.id} className="border border-gray-200 rounded-lg">
                          <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-base font-medium text-gray-900">{lesson.title}</h4>
                                <p className="text-sm text-gray-500 mt-1">
                                  Q&A prompt for this specific lesson
                                </p>
                              </div>
                              {lessonPrompt ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => previewSystemPrompt(lessonPrompt)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="Open in new window"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingPrompt(lessonPrompt)}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="Edit prompt"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => exportSystemPrompt(lessonPrompt)}
                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                    title="Export as file"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => createLessonPrompt(lesson.id)}
                                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                                >
                                  <Plus className="w-4 h-4" />
                                  Create Prompt
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="p-4">
                            {lessonPrompt ? (
                              editingPrompt?.id === lessonPrompt.id ? (
                                // Edit Form for lesson prompt
                                <form onSubmit={updateSystemPrompt} className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Text File (optional - leave empty to keep current content)
                                    </label>
                                    <input
                                      type="file"
                                      name="file"
                                      accept=".txt,.md"
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="bg-gray-50 p-4 rounded-md">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Current content preview:</p>
                                    <pre className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                                      {lessonPrompt.content.substring(0, 200)}
                                      {lessonPrompt.content.length > 200 && '...'}
                                    </pre>
                                  </div>
                                  <div className="flex gap-3">
                                    <button
                                      type="submit"
                                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                      <Save className="w-4 h-4" />
                                      Save Changes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPrompt(null)}
                                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                // Display Mode for lesson prompt
                                <div>
                                  <div className="grid md:grid-cols-2 gap-4 mb-3">
                                    <div className="text-sm text-gray-600">
                                      <span className="font-medium">Content:</span> {lessonPrompt.content.length} characters
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      <span className="font-medium">Updated:</span> {new Date(lessonPrompt.updatedAt).toLocaleDateString()}
                                    </div>
                                  </div>
                                  <div className="bg-green-50 rounded-md p-3">
                                    <p className="text-sm font-medium text-green-700 mb-1">Content preview:</p>
                                    <pre className="text-sm text-green-800 whitespace-pre-wrap leading-relaxed">
                                      {lessonPrompt.content.substring(0, 200)}
                                      {lessonPrompt.content.length > 200 && '...'}
                                    </pre>
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="text-center py-6 text-gray-500">
                                <p className="text-sm mb-3">No custom prompt for this lesson. The general lesson Q&A prompt will be used.</p>
                                <button
                                  onClick={() => createLessonPrompt(lesson.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mx-auto"
                                >
                                  <Plus className="w-4 h-4" />
                                  Create Custom Prompt
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'knowledge' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Knowledge Base</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUploadKnowledgeForm(!showUploadKnowledgeForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {showUploadKnowledgeForm ? 'Cancel' : 'Upload File'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('This will sync all lesson transcripts to the knowledge base. Continue?')) return;
                      
                      setSyncingTranscripts(true);
                      try {
                        const response = await fetch('/api/admin/sync-transcripts', {
                          method: 'POST',
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                          alert(`${result.message}\n\nSynced: ${result.synced} transcripts\nErrors: ${result.errors}`);
                          await loadData(); // Reload knowledge base files
                        } else {
                          setError('Failed to sync transcripts to knowledge base');
                        }
                      } catch (err) {
                        setError('Failed to sync transcripts to knowledge base');
                      } finally {
                        setSyncingTranscripts(false);
                      }
                    }}
                    disabled={syncingTranscripts}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncingTranscripts ? 'animate-spin' : ''}`} />
                    {syncingTranscripts ? 'Syncing...' : 'Sync Transcripts'}
                  </button>
                </div>
              </div>

              {/* Upload Form */}
              {showUploadKnowledgeForm && (
                <form onSubmit={uploadKnowledgeFile} className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="text-lg font-medium mb-4">Upload Knowledge Base File</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        File
                      </label>
                      <input
                        ref={knowledgeFileInputRef}
                        type="file"
                        name="file"
                        accept=".txt,.md,.pdf,.csv"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Supported formats: TXT, PDF, CSV, Markdown
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Indexed Content (optional)
                      </label>
                      <textarea
                        name="indexedContent"
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Provide a summary or key points for better Q&A matching..."
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Optional: Add searchable content to improve Q&A responses
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        <Upload className="w-4 h-4" />
                        Upload File
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowUploadKnowledgeForm(false)}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  Upload files to enhance the Q&A capabilities. The system will use these files to provide more accurate and detailed responses during personalized sessions.
                </p>
              </div>

              {knowledgeFiles.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Upload className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg mb-2">No knowledge base files uploaded yet</p>
                  <p className="text-sm">Upload your first file to enhance the Q&A capabilities.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {knowledgeFiles.map((file) => (
                    <div key={file.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">{file.filename}</h3>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {file.fileType}
                            </span>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Uploaded:</span> {new Date(file.uploadedAt).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Type:</span> {file.fileType}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={() => deleteKnowledgeFile(file.id, file.filename)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentTab === 'opening-messages' && (
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Opening Messages</h2>
                <p className="text-gray-600">Configure TTS messages spoken at the start of conversations</p>
              </div>

              {/* General Opening Message */}
              <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">General Opening Message</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Spoken when users start an open-ended conversation (not lesson-based)
                    </p>
                  </div>
                </div>
                
                {openingMessages.general ? (
                  <div className="space-y-4">
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const messageContent = formData.get('generalMessage') as string;
                        
                        try {
                          const response = await fetch('/api/admin/style-opening-message', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'direct_update',
                              messageId: openingMessages.general.id,
                              userInput: messageContent
                            })
                          });
                          
                          if (response.ok) {
                            await loadData();
                            setError(null);
                          } else {
                            setError('Failed to update general opening message');
                          }
                        } catch (err) {
                          setError('Failed to update general opening message');
                        }
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Opening Message:
                        </label>
                        <textarea
                          name="generalMessage"
                          defaultValue={openingMessages.general.messageContent}
                          onChange={(e) => handleOpeningMessageFieldChange('general', e.target.value)}
                          rows={4}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter the opening message..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const textarea = document.querySelector('textarea[name="generalMessage"]') as HTMLTextAreaElement;
                            const currentValue = textarea?.value || openingMessageFormData['general'] || '';
                            styleOpeningMessage(openingMessages.general.id, currentValue, 'general');
                          }}
                          disabled={isStylingMessage[openingMessages.general.id]}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isStylingMessage[openingMessages.general.id] ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Styling...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              <span>Style Message</span>
                            </>
                          )}
                        </button>
                        <button
                          type="submit"
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          <Save className="w-4 h-4" />
                          Save Message
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const messageContent = formData.get('generalMessage') as string;
                      
                      try {
                        const response = await fetch('/api/admin/opening-messages', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'set_general',
                            messageContent,
                            voiceSettings: {
                              voiceId: 'MXGyTMlsvQgQ4BL0emIa',
                              speed: 0.85,
                              stability: 0.6,
                              similarityBoost: 0.8
                            }
                          })
                        });
                        
                        if (response.ok) {
                          await loadData();
                          setError(null);
                        } else {
                          setError('Failed to create general opening message');
                        }
                      } catch (err) {
                        setError('Failed to create general opening message');
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Create General Opening Message:
                      </label>
                      <textarea
                        name="generalMessage"
                        rows={3}
                        className="w-full p-3 border border-gray-300 rounded-md"
                        placeholder="Hello! I'm Sanjay, your AI financial advisor..."
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      Create General Message
                    </button>
                  </form>
                )}
              </div>

              {/* Lesson-Specific Opening Messages */}
              <div className="p-6 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-4">Lesson Opening Messages</h3>
                <p className="text-sm text-green-700 mb-6">
                  Specific messages spoken when starting each lesson
                </p>

                <div className="space-y-4">
                  {openingMessages.lessons && openingMessages.lessons.map((lesson: any) => {
                    const lessonMessage = openingMessages.lessonMessages?.find((msg: any) => msg.lessonId === lesson.id);
                    
                    return (
                      <div key={lesson.id} className="p-4 bg-white rounded border">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{lesson.title}</h4>
                            <p className="text-sm text-gray-600">{lesson.videoSummary.substring(0, 100)}...</p>
                          </div>
                        </div>
                        
                        {lessonMessage ? (
                          <div className="space-y-3">
                            <div className="p-3 bg-gray-50 rounded">
                              <div className="text-sm font-medium text-gray-700 mb-1">Current Message:</div>
                              <div className="text-gray-900">{lessonMessage.messageContent}</div>
                            </div>
                            
                            <form 
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const messageContent = formData.get('lessonMessage') as string;
                                
                                try {
                                  const response = await fetch('/api/admin/opening-messages', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      action: 'set_lesson',
                                      lessonId: lesson.id,
                                      messageContent,
                                      voiceSettings: {
                                        voiceId: 'MXGyTMlsvQgQ4BL0emIa',
                                        speed: 0.85,
                                        stability: 0.6,
                                        similarityBoost: 0.8
                                      }
                                    })
                                  });
                                  
                                  if (response.ok) {
                                    await loadData();
                                    setError(null);
                                  } else {
                                    setError('Failed to update lesson opening message');
                                  }
                                } catch (err) {
                                  setError('Failed to update lesson opening message');
                                }
                              }}
                              className="flex gap-2"
                            >
                              <textarea
                                name="lessonMessage"
                                defaultValue={lessonMessage.messageContent}
                                rows={2}
                                className="flex-1 p-2 border border-gray-300 rounded-md text-sm"
                                placeholder="Enter lesson intro message..."
                              />
                              <button
                                type="submit"
                                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                              >
                                Update
                              </button>
                            </form>
                          </div>
                        ) : (
                          <form 
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              const messageContent = formData.get('lessonMessage') as string;
                              
                              try {
                                const response = await fetch('/api/admin/opening-messages', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    action: 'set_lesson',
                                    lessonId: lesson.id,
                                    messageContent,
                                    voiceSettings: {
                                      voiceId: 'MXGyTMlsvQgQ4BL0emIa',
                                      speed: 0.85,
                                      stability: 0.6,
                                      similarityBoost: 0.8
                                    }
                                  })
                                });
                                
                                if (response.ok) {
                                  await loadData();
                                  setError(null);
                                } else {
                                  setError('Failed to create lesson opening message');
                                }
                              } catch (err) {
                                setError('Failed to create lesson opening message');
                              }
                            }}
                            className="flex gap-2"
                          >
                            <textarea
                              name="lessonMessage"
                              rows={2}
                              className="flex-1 p-2 border border-gray-300 rounded-md text-sm"
                              placeholder={`Welcome to the lesson on ${lesson.title}...`}
                              required
                            />
                            <button
                              type="submit"
                              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                            >
                              Create
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(!openingMessages.lessons || openingMessages.lessons.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    No lessons found. Create lessons first to add opening messages.
                  </div>
                )}
              </div>

              {/* Voice Settings Info */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Voice Settings</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Voice:</strong> Professional Male (MXGyTMlsvQgQ4BL0emIa)</p>
                  <p><strong>Speed:</strong> 0.85x (slightly slower for clarity)</p>
                  <p><strong>Stability:</strong> 0.6 (balanced)</p>
                  <p><strong>Similarity Boost:</strong> 0.8 (high voice consistency)</p>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'reports' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Report Management</h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    Base template & generated reports
                  </span>
                </div>
              </div>

              {/* Base Report Template Section - Primary Focus */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Base Report Template
                </h3>
                
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 mb-2">
                    <span className="font-medium">Report Structure:</span> Each generated report contains three parts:
                  </p>
                  <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-700">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-900 font-bold text-xs">1</div>
                      <span>Your PDF template</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-900 font-bold text-xs">2</div>
                      <span>Q&A summary</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-blue-900 font-bold text-xs">3</div>
                      <span>Full transcript</span>
                    </div>
                  </div>
                </div>

                {hasBaseTemplate ? (
                  <div className="space-y-6">
                    {/* Current Template Status */}
                    <div className="border border-green-200 bg-green-50 rounded-lg p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-green-800 mb-1">Base template is active</h4>
                          <p className="text-sm text-green-600 mb-3">
                            All new session reports will use your custom PDF template as the first section, 
                            followed by auto-generated Q&A summaries and conversation transcripts.
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Template Active
                            </span>
                            <span className="text-sm text-green-600">
                              Uploaded: {settings?.baseReportPath ? new Date().toLocaleDateString() : 'Unknown'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={removeBaseTemplate}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove base template"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Replace Template Form */}
                    <div className="border border-gray-200 rounded-lg p-6">
                      <h4 className="font-medium text-gray-900 mb-3">Replace Base Template</h4>
                      <form onSubmit={uploadBaseTemplate} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload New PDF Template
                          </label>
                          <input
                            ref={baseTemplateInputRef}
                            type="file"
                            name="file"
                            accept=".pdf"
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            Upload a new PDF template to replace the current one. Should include your branding, intro content, and styling.
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="submit"
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                          >
                            <Upload className="w-4 h-4" />
                            Replace Template
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                ) : (
                  /* No Template - Upload Form */
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                    <div className="text-center mb-6">
                      <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No base template uploaded</h4>
                      <p className="text-gray-500 max-w-md mx-auto">
                        Upload a PDF template to provide professional branding and formatting for all generated reports.
                      </p>
                    </div>
                    
                    <form onSubmit={uploadBaseTemplate} className="max-w-md mx-auto space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                          Upload Base Template PDF
                        </label>
                        <input
                          ref={baseTemplateInputRef}
                          type="file"
                          name="file"
                          accept=".pdf"
                          required
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="mt-1 text-sm text-gray-500 text-left">
                          This PDF will become the first part of every generated report
                        </p>
                      </div>
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Template
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Recent Generated Reports Section - Secondary */}
              <div className="border-t pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Recent Generated Reports
                  <span className="text-sm font-normal text-gray-500">({reports.length} total)</span>
                </h3>

                {reports.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No session reports generated yet</p>
                    <p className="text-xs text-gray-400">Reports will appear here as users complete educational sessions</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 mb-6">
                      {reports.slice(0, 5).map((report) => (
                        <div key={report.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-medium text-gray-900">
                                  Session {report.sessionId.slice(-8)}
                                </span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                  PDF
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>Generated: {new Date(report.generatedAt).toLocaleDateString()}</span>
                                <span>at {new Date(report.generatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => downloadReport(report.id, report.sessionId)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Download PDF report"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteReport(report.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete report"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {reports.length > 5 && (
                      <div className="text-center py-3 border-t">
                        <p className="text-sm text-gray-500">
                          Showing 5 of {reports.length} reports • 
                          <span className="text-blue-600 ml-1 cursor-pointer hover:underline">View all reports</span>
                        </p>
                      </div>
                    )}

                    {/* Quick Stats */}
                    <div className="mt-6 grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">This Week</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {reports.filter(r => {
                            const reportDate = new Date(r.generatedAt);
                            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                            return reportDate >= weekAgo;
                          }).length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">This Month</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {reports.filter(r => {
                            const reportDate = new Date(r.generatedAt);
                            const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                            return reportDate >= monthAgo;
                          }).length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600">Unique Sessions</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {new Set(reports.map(r => r.sessionId)).size}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Audio Management Tab */}
          {currentTab === 'audio-management' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Audio Management</h2>
                  <p className="text-gray-600">Manage TTS audio cache and generation</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {audioCache.length} cached files
                  </span>
                </div>
              </div>

              {/* Audio Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart2 className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Total Files</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{audioStats.totalFiles}</p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Cache Size</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {audioStats.totalSize ? (audioStats.totalSize / 1024 / 1024).toFixed(1) : '0.0'}MB
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Headphones className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Hit Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">{audioStats.cacheHitRate}%</p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <RefreshCw className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Last Updated</span>
                  </div>
                  <p className="text-sm font-bold text-orange-900">Just now</p>
                </div>
              </div>

              {/* Bulk Audio Controls */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Operations</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/regenerate-audio', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ all: true })
                        });
                        const result = await response.json();
                        if (result.success) {
                          setError(null);
                          // Refresh audio cache data
                          await loadAudioData();
                        } else {
                          setError(result.error);
                        }
                      } catch (err) {
                        setError('Failed to regenerate all audio');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate All Audio
                  </button>

                  <button
                    onClick={async () => {
                      const daysOld = prompt('Clear cache older than how many days?', '30');
                      if (daysOld && !isNaN(Number(daysOld))) {
                        try {
                          const response = await fetch(`/api/admin/regenerate-audio?daysOld=${daysOld}`, {
                            method: 'DELETE'
                          });
                          const result = await response.json();
                          if (result.success) {
                            setError(null);
                            await loadAudioData();
                          } else {
                            setError(result.error);
                          }
                        } catch (err) {
                          setError('Failed to clear old cache');
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Old Cache
                  </button>

                  <button
                    onClick={loadAudioData}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Data
                  </button>
                </div>
              </div>

              {/* Audio Cache List */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cached Audio Files</h3>
                
                {audioCache.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Volume2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">No cached audio files found</p>
                    <p className="text-sm">Audio will be cached as TTS messages are generated</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {audioCache.map((audio) => (
                      <div key={audio.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Volume2 className="w-5 h-5 text-gray-400" />
                              <span className="font-medium text-gray-900">
                                {audio.content ? audio.content.substring(0, 60) + (audio.content.length > 60 ? '...' : '') : 'Audio Message'}
                              </span>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                {audio.voice_id || 'Default Voice'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Size: {(audio.file_size / 1024).toFixed(1)}KB</span>
                              <span>Created: {new Date(audio.created_at).toLocaleDateString()}</span>
                              <span>Format: {audio.audio_format || 'MP3'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                // Play audio functionality will be added
                                console.log('Play audio:', audio.id);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Play Audio"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch('/api/admin/regenerate-audio', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ messageId: audio.id })
                                  });
                                  const result = await response.json();
                                  if (result.success) {
                                    setError(null);
                                    await loadAudioData();
                                  } else {
                                    setError(result.error);
                                  }
                                } catch (err) {
                                  setError('Failed to regenerate audio');
                                }
                              }}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Regenerate Audio"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Delete this cached audio file?')) {
                                  try {
                                    // Delete functionality will be added to API
                                    console.log('Delete audio:', audio.id);
                                    await loadAudioData();
                                  } catch (err) {
                                    setError('Failed to delete audio');
                                  }
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Delete Audio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debug & Monitor Tab */}
          {currentTab === 'debug' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Debug & Monitor</h2>
                  <p className="text-gray-600">System diagnostics and monitoring tools</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadDebugData}
                    disabled={debugLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${debugLoading ? 'animate-spin' : ''}`} />
                    {debugLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {/* System Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">System Status</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {debugInfo.database?.status === 'connected' ? 'Healthy' : 'Issues'}
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-800">API Status</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {Object.values(debugInfo.apis || {}).filter(api => api.ok).length} / {Object.keys(debugInfo.apis || {}).length}
                  </p>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Environment</span>
                  </div>
                  <p className="text-lg font-bold text-purple-900">
                    {debugInfo.system?.environment || 'Unknown'}
                  </p>
                </div>

                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Sessions</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-900">
                    {debugInfo.sessions?.length || 0}
                  </p>
                </div>
              </div>

              {/* LLM Debug Capture Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    LLM Debug Capture
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="debugCaptureToggle"
                        checked={settings?.debugLlmEnabled || false}
                        onChange={async (e) => {
                          try {
                            const response = await fetch('/api/debug-llm', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'toggle',
                                enabled: e.target.checked
                              })
                            });
                            if (response.ok) {
                              await loadData(); // Refresh settings
                            }
                          } catch (error) {
                            console.error('Failed to toggle debug capture:', error);
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="debugCaptureToggle" className="ml-2 text-sm font-medium text-gray-900">
                        Enable Capture
                      </label>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch('/api/debug-llm', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'clear' })
                          });
                          if (response.ok) {
                            await loadDebugData();
                          }
                        } catch (error) {
                          console.error('Failed to clear debug data:', error);
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                </div>

                {settings?.debugLlmEnabled ? (
                  <div className="space-y-4">
                    {/* Debug Statistics */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-3 rounded border">
                        <div className="text-2xl font-bold text-blue-900">
                          {debugInfo.llmStats?.totalEntries || 0}
                        </div>
                        <div className="text-xs text-blue-600">Total Entries</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded border">
                        <div className="text-2xl font-bold text-green-900">
                          {debugInfo.llmStats?.currentSessionEntries || 0}
                        </div>
                        <div className="text-xs text-green-600">Current Session</div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded border">
                        <div className="text-2xl font-bold text-purple-900">
                          {debugInfo.llmStats?.totalSessions || 0}
                        </div>
                        <div className="text-xs text-purple-600">Debug Sessions</div>
                      </div>
                    </div>

                    {/* Recent LLM Interactions */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Recent LLM Interactions</h4>
                      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded">
                        {debugInfo.recentEntries && debugInfo.recentEntries.length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {debugInfo.recentEntries.slice(0, 10).map((entry, index) => (
                              <div key={entry.id || index} className="p-3 hover:bg-gray-50">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${
                                      entry.status === 'success' ? 'bg-green-500' :
                                      entry.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                                    }`}></span>
                                    <span className="text-xs font-medium text-gray-600 uppercase">
                                      {entry.type}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {entry.request?.model || 'unknown'}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 truncate mb-1">
                                  {entry.request?.systemPrompt?.substring(0, 80)}...
                                </div>
                                {entry.status === 'success' && entry.response && (
                                  <div className="text-xs text-gray-500">
                                    Response: {entry.response.content?.substring(0, 60)}...
                                    {entry.response.processingTime && (
                                      <span className="ml-2 text-blue-600">
                                        ({entry.response.processingTime}ms)
                                      </span>
                                    )}
                                  </div>
                                )}
                                {entry.status === 'error' && entry.error && (
                                  <div className="text-xs text-red-600">
                                    Error: {entry.error}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center text-gray-500 text-sm">
                            No debug entries captured yet. LLM interactions will appear here when debug capture is enabled.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="mb-2">LLM Debug Capture is disabled</p>
                    <p className="text-sm">Enable it to monitor AI interactions in real-time</p>
                  </div>
                )}
              </div>

              {/* System Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    System Information
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Timestamp:</span>
                      <span className="font-mono">{debugInfo.system?.timestamp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Environment:</span>
                      <span className={`font-medium ${debugInfo.system?.environment === 'production' ? 'text-green-600' : 'text-orange-600'}`}>
                        {debugInfo.system?.environment}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Platform:</span>
                      <span className="font-mono">{debugInfo.system?.platform}</span>
                    </div>
                    {debugInfo.system?.language && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Language:</span>
                        <span>{debugInfo.system.language}</span>
                      </div>
                    )}
                    {debugInfo.system?.timezone && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Timezone:</span>
                        <span>{debugInfo.system.timezone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Online:</span>
                      <span className={debugInfo.system?.onLine ? 'text-green-600' : 'text-red-600'}>
                        {debugInfo.system?.onLine ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                    {debugInfo.system?.localStorage !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">LocalStorage Keys:</span>
                        <span>{debugInfo.system.localStorage}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Database Status
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Connection:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        debugInfo.database?.status === 'connected' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {debugInfo.database?.status || 'Unknown'}
                      </span>
                    </div>
                    {debugInfo.database?.timestamp && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Check:</span>
                        <span className="font-mono">
                          {new Date(debugInfo.database.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    {debugInfo.database?.environment && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">DB Environment:</span>
                        <span>{debugInfo.database.environment}</span>
                      </div>
                    )}
                    {debugInfo.database?.error && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                        <strong>Error:</strong> {debugInfo.database.error}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* API Endpoints Status */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  API Endpoints Status
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Endpoint</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Status</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Response Time</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-700">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(debugInfo.apis || {}).map(([name, info]) => (
                        <tr key={name} className="border-b border-gray-100">
                          <td className="py-2 px-3 font-medium">{name}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              info.ok 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {info.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {info.responseTime ? `${info.responseTime}ms` : 'N/A'}
                          </td>
                          <td className="py-2 px-3">
                            {info.size && info.size !== 'unknown' ? info.size : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Sessions Debug */}
              {debugInfo.sessions && debugInfo.sessions.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Terminal className="w-5 h-5" />
                    Recent Sessions ({debugInfo.sessions.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {debugInfo.sessions.map((session, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded border text-sm">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-mono text-gray-700">
                            {session.id || session.sessionId || 'Unknown ID'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {session.timestamp || session.createdAt || 'No timestamp'}
                          </span>
                        </div>
                        {session.status && (
                          <div className="text-xs text-gray-600">
                            Status: {session.status}
                          </div>
                        )}
                        {session.error && (
                          <div className="text-xs text-red-600 mt-1">
                            Error: {session.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Environment Variables (Safe ones only) */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Environment Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">NODE_ENV:</span>
                      <span className={`font-medium ${
                        debugInfo.system?.environment === 'production' 
                          ? 'text-green-600' 
                          : 'text-orange-600'
                      }`}>
                        {debugInfo.system?.environment || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">API Keys Present:</span>
                      <span className="text-gray-900">
                        {typeof window !== 'undefined' && (
                          <>
                            ANTHROPIC: {process.env.ANTHROPIC_API_KEY ? '✓' : '✗'} | 
                            ELEVENLABS: {process.env.ELEVENLABS_API_KEY ? '✓' : '✗'}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Build Time:</span>
                      <span className="font-mono text-xs">{new Date().toISOString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Railway Deploy:</span>
                      <span className={process.env.RAILWAY_ENVIRONMENT ? 'text-green-600' : 'text-gray-400'}>
                        {process.env.RAILWAY_ENVIRONMENT ? 'Active' : 'Local'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
        </div>
      </div>
    </div>
  );
}