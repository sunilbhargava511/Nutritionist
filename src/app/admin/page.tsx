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
  BarChart2
} from 'lucide-react';
import { 
  Lesson,
  AdminSettings, 
  SystemPrompt, 
  KnowledgeBaseFile,
  SessionReport 
} from '@/types';
import AppHeader from '@/components/AppHeader';

type AdminTab = 'lessons' | 'settings' | 'prompts' | 'knowledge' | 'reports' | 'opening-messages' | 'audio-management';
type SettingsTab = 'general' | 'voice' | 'ui';


export default function AdminPanel() {
  const [currentTab, setCurrentTab] = useState<AdminTab>('lessons');
  const [currentSettingsTab, setCurrentSettingsTab] = useState<SettingsTab>('general');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeBaseFile[]>([]);
  const [reports, setReports] = useState<SessionReport[]>([]);
  const [openingMessages, setOpeningMessages] = useState<any>({ general: null, lessonMessages: [], lessons: [] });
  const [audioCache, setAudioCache] = useState<any[]>([]);
  const [audioStats, setAudioStats] = useState<any>({ totalFiles: 0, totalSize: 0, cacheHitRate: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedLesson, setDraggedLesson] = useState<string | null>(null);
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
  }, []);
  
  // Save UI preferences to localStorage when they change
  useEffect(() => {
    localStorage.setItem('admin_ui_preferences', JSON.stringify(uiPreferences));
  }, [uiPreferences]);

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

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [lessonsRes, settingsRes, promptsRes, knowledgeRes, reportsRes, templateRes, openingMessagesRes] = await Promise.all([
        fetch('/api/lessons'),
        fetch('/api/admin/settings'),
        fetch('/api/admin/prompts'),
        fetch('/api/admin/knowledge-base'),
        fetch('/api/reports'),
        fetch('/api/admin/base-template'),
        fetch('/api/admin/opening-messages')
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

  // Store generated summaries to avoid re-generating

  // Lesson Management Functions
  const createLesson = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const lessonData = {
      title: formData.get('title') as string,
      videoUrl: formData.get('videoUrl') as string,
      videoSummary: formData.get('videoSummary') as string,
      startMessage: formData.get('startMessage') as string || undefined,
      question: formData.get('question') as string,
      prerequisites: JSON.parse((formData.get('prerequisites') as string) || '[]'),
    };
    
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
        (e.target as HTMLFormElement).reset();
        setShowLessonForm(false);
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

    const formData = new FormData(e.currentTarget);
    
    const updates = {
      title: formData.get('title') as string,
      videoUrl: formData.get('videoUrl') as string,
      videoSummary: formData.get('videoSummary') as string,
      startMessage: formData.get('startMessage') as string || undefined,
      question: formData.get('question') as string,
      prerequisites: JSON.parse((formData.get('prerequisites') as string) || '[]'),
    };
    
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
              <p className="text-sm text-gray-500">Manage educational content</p>
            </div>
            <nav className="p-4 space-y-2">
              {[
                { id: 'lessons', label: 'Lessons', icon: FileText, count: lessons.length },
                { id: 'prompts', label: 'System Prompts', icon: Database, count: prompts.length },
                { id: 'knowledge', label: 'Knowledge Base', icon: Upload, count: knowledgeFiles.length },
                { id: 'opening-messages', label: 'Opening Messages', icon: MessageSquare },
                { id: 'audio-management', label: 'Audio Management', icon: Volume2, count: audioCache.length },
                { id: 'reports', label: 'Report Template', icon: BarChart3, count: hasBaseTemplate ? 1 : 0 },
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lesson Title
                      </label>
                      <input
                        type="text"
                        name="title"
                        required
                        defaultValue={editingLesson?.title || ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Introduction to Retirement Planning"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        YouTube Video URL
                      </label>
                      <input
                        type="url"
                        name="videoUrl"
                        required
                        defaultValue={editingLesson?.videoUrl || ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        YouTube video URL for this lesson
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Video Summary (for LLM Context)
                      </label>
                      <textarea
                        name="videoSummary"
                        required
                        rows={4}
                        defaultValue={editingLesson?.videoSummary || ''}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Summarize the key concepts covered in this video for the AI to use during Q&A..."
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        This summary helps the AI provide contextual responses during Q&A
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Message (TTS Introduction)
                      </label>
                      <textarea
                        name="startMessage"
                        rows={3}
                        defaultValue={editingLesson?.startMessage || ''}
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
                        defaultValue={JSON.stringify(editingLesson?.prerequisites || [])}
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
                    { id: 'voice', name: 'Voice Settings', icon: Settings },
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

              {/* Voice Settings */}
              {currentSettingsTab === 'voice' && (
                <form onSubmit={updateSettings} className="max-w-2xl space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ElevenLabs Voice ID
                    </label>
                    <input
                      type="text"
                      name="voiceId"
                      defaultValue={settings?.voiceId || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., pNInz6obpgDQGcFmaJgB"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      The ElevenLabs voice ID to use for all audio generation
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voice Characteristics
                    </label>
                    <textarea
                      name="voiceDescription"
                      rows={3}
                      defaultValue={settings?.voiceDescription || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Make voice deeper and slower, less nasal, more authoritative"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Describe how you want the voice to sound using natural language
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency Formatting
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="currencyRupees"
                          name="currencyFormat"
                          value="rupees"
                          defaultChecked={true}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <label htmlFor="currencyRupees" className="ml-2 block text-sm text-gray-900">
                          Always say "rupees" (recommended for voice)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="currencySymbol"
                          name="currencyFormat"
                          value="symbol"
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <label htmlFor="currencySymbol" className="ml-2 block text-sm text-gray-900">
                          Use symbols (₹, Rs) for text display
                        </label>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      Choose how currency should be formatted in voice responses
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number Formatting
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="spellOutNumbers"
                          name="spellOutNumbers"
                          defaultChecked={true}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="spellOutNumbers" className="ml-2 block text-sm text-gray-900">
                          Spell out numbers ("thirty thousand" instead of "30K")
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="useIndianSystem"
                          name="useIndianSystem"
                          defaultChecked={true}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="useIndianSystem" className="ml-2 block text-sm text-gray-900">
                          Use Indian number system ("one lakh", "one crore")
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Response Length
                    </label>
                    <input
                      type="number"
                      name="maxResponseSeconds"
                      defaultValue={45}
                      min={15}
                      max={120}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-500">seconds maximum</span>
                    <p className="mt-1 text-sm text-gray-500">
                      Maximum length for voice responses to maintain engagement
                    </p>
                  </div>

                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                  >
                    <Save className="w-4 h-4" />
                    Save Voice Settings
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
                <button
                  onClick={() => setShowUploadKnowledgeForm(!showUploadKnowledgeForm)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {showUploadKnowledgeForm ? 'Cancel' : 'Upload File'}
                </button>
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
                <h3 className="text-lg font-semibold text-blue-900 mb-4">General Opening Message</h3>
                <p className="text-sm text-blue-700 mb-4">
                  Spoken when users start an open-ended conversation (not lesson-based)
                </p>
                
                {openingMessages.general ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded border">
                      <div className="text-sm font-medium text-gray-700 mb-2">Current Message:</div>
                      <div className="text-gray-900">{openingMessages.general.messageContent}</div>
                    </div>
                    
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
                          Update Message:
                        </label>
                        <textarea
                          name="generalMessage"
                          defaultValue={openingMessages.general.messageContent}
                          rows={3}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          placeholder="Enter the opening message..."
                        />
                      </div>
                      <button
                        type="submit"
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        <Save className="w-4 h-4" />
                        Update General Message
                      </button>
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

        </div>
        </div>
      </div>
    </div>
  );
}