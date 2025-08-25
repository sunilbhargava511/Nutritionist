'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Webapp } from '@/lib/database/schema';

interface WebappContextType {
  currentWebapp: Webapp | null;
  webapps: Webapp[];
  isLoading: boolean;
  error: string | null;
  switchWebapp: (webappKey: string) => Promise<void>;
  refreshWebapps: () => Promise<void>;
  createWebapp: (webappData: Partial<Webapp>) => Promise<void>;
  updateWebapp: (webappKey: string, updates: Partial<Webapp>) => Promise<void>;
  deleteWebapp: (webappKey: string) => Promise<void>;
}

const WebappContext = createContext<WebappContextType | undefined>(undefined);

interface WebappProviderProps {
  children: ReactNode;
  defaultWebappKey?: string;
}

export function WebappProvider({ children, defaultWebappKey }: WebappProviderProps) {
  const [currentWebapp, setCurrentWebapp] = useState<Webapp | null>(null);
  const [webapps, setWebapps] = useState<Webapp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load webapps and set current webapp
  const loadWebapps = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/webapps');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load webapps');
      }
      
      const webappsList = data.webapps || [];
      setWebapps(webappsList);
      
      // Determine current webapp
      let targetWebappKey = defaultWebappKey;
      
      // Check localStorage for last selected webapp
      if (!targetWebappKey && typeof window !== 'undefined') {
        targetWebappKey = localStorage.getItem('current-webapp-key') || undefined;
      }
      
      // Find webapp by key or use first active webapp
      let targetWebapp: Webapp | null = null;
      
      if (targetWebappKey) {
        targetWebapp = webappsList.find((w: Webapp) => w.webappKey === targetWebappKey) || null;
      }
      
      if (!targetWebapp) {
        // Find first active webapp
        targetWebapp = webappsList.find((w: Webapp) => w.isActive) || webappsList[0] || null;
      }
      
      setCurrentWebapp(targetWebapp);
      
      // Save current webapp key to localStorage
      if (targetWebapp && typeof window !== 'undefined') {
        localStorage.setItem('current-webapp-key', targetWebapp.webappKey);
      }
      
    } catch (err) {
      console.error('Error loading webapps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load webapps');
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to different webapp
  const switchWebapp = async (webappKey: string) => {
    try {
      setError(null);
      
      const targetWebapp = webapps.find(w => w.webappKey === webappKey);
      if (!targetWebapp) {
        throw new Error(`Webapp '${webappKey}' not found`);
      }
      
      setCurrentWebapp(targetWebapp);
      
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('current-webapp-key', webappKey);
      }
      
      // Trigger custom event for other components to react to webapp changes
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('webapp-changed', { 
          detail: { webappKey, webapp: targetWebapp } 
        }));
      }
      
    } catch (err) {
      console.error('Error switching webapp:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch webapp');
      throw err;
    }
  };

  // Refresh webapps list
  const refreshWebapps = async () => {
    await loadWebapps();
  };

  // Create new webapp
  const createWebapp = async (webappData: Partial<Webapp>) => {
    try {
      setError(null);
      
      const response = await fetch('/api/admin/webapps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webappData)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create webapp');
      }
      
      // Refresh webapps list
      await refreshWebapps();
      
      // Switch to newly created webapp
      if (data.webapp?.webappKey) {
        await switchWebapp(data.webapp.webappKey);
      }
      
    } catch (err) {
      console.error('Error creating webapp:', err);
      setError(err instanceof Error ? err.message : 'Failed to create webapp');
      throw err;
    }
  };

  // Update webapp
  const updateWebapp = async (webappKey: string, updates: Partial<Webapp>) => {
    try {
      setError(null);
      
      const response = await fetch(`/api/admin/webapps/${webappKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update webapp');
      }
      
      // Update local state
      setWebapps(prev => prev.map(w => 
        w.webappKey === webappKey ? { ...w, ...updates } : w
      ));
      
      if (currentWebapp?.webappKey === webappKey) {
        setCurrentWebapp(prev => prev ? { ...prev, ...updates } : null);
      }
      
    } catch (err) {
      console.error('Error updating webapp:', err);
      setError(err instanceof Error ? err.message : 'Failed to update webapp');
      throw err;
    }
  };

  // Delete webapp
  const deleteWebapp = async (webappKey: string) => {
    try {
      setError(null);
      
      const response = await fetch(`/api/admin/webapps/${webappKey}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete webapp');
      }
      
      // Remove from local state
      setWebapps(prev => prev.filter(w => w.webappKey !== webappKey));
      
      // If we deleted the current webapp, switch to another one
      if (currentWebapp?.webappKey === webappKey) {
        const remainingWebapps = webapps.filter(w => w.webappKey !== webappKey);
        const nextWebapp = remainingWebapps.find(w => w.isActive) || remainingWebapps[0] || null;
        setCurrentWebapp(nextWebapp);
        
        if (nextWebapp && typeof window !== 'undefined') {
          localStorage.setItem('current-webapp-key', nextWebapp.webappKey);
        }
      }
      
    } catch (err) {
      console.error('Error deleting webapp:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete webapp');
      throw err;
    }
  };

  // Load webapps on mount
  useEffect(() => {
    loadWebapps();
  }, [defaultWebappKey]);

  const contextValue: WebappContextType = {
    currentWebapp,
    webapps,
    isLoading,
    error,
    switchWebapp,
    refreshWebapps,
    createWebapp,
    updateWebapp,
    deleteWebapp
  };

  return (
    <WebappContext.Provider value={contextValue}>
      {children}
    </WebappContext.Provider>
  );
}

// Hook to use webapp context
export function useWebapp() {
  const context = useContext(WebappContext);
  if (context === undefined) {
    throw new Error('useWebapp must be used within a WebappProvider');
  }
  return context;
}

// Hook to get current webapp key (for API calls)
export function useWebappKey(): string | null {
  const { currentWebapp } = useWebapp();
  return currentWebapp?.webappKey || null;
}

// Higher-order component to inject webapp key into components
export function withWebapp<T extends { webappKey?: string }>(
  Component: React.ComponentType<T>
) {
  return function WebappWrappedComponent(props: Omit<T, 'webappKey'>) {
    const webappKey = useWebappKey();
    return <Component {...(props as T)} webappKey={webappKey || undefined} />;
  };
}

// Webapp selector component
interface WebappSelectorProps {
  onChange?: (webappKey: string) => void;
  className?: string;
  disabled?: boolean;
}

export function WebappSelector({ onChange, className, disabled }: WebappSelectorProps) {
  const { currentWebapp, webapps, isLoading, switchWebapp } = useWebapp();

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newWebappKey = event.target.value;
    if (newWebappKey && newWebappKey !== currentWebapp?.webappKey) {
      try {
        await switchWebapp(newWebappKey);
        onChange?.(newWebappKey);
      } catch (error) {
        console.error('Failed to switch webapp:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <select className={className} disabled>
        <option>Loading webapps...</option>
      </select>
    );
  }

  if (webapps.length === 0) {
    return (
      <select className={className} disabled>
        <option>No webapps available</option>
      </select>
    );
  }

  return (
    <select
      value={currentWebapp?.webappKey || ''}
      onChange={handleChange}
      className={className}
      disabled={disabled}
    >
      {webapps.map(webapp => (
        <option key={webapp.webappKey} value={webapp.webappKey}>
          {webapp.businessName} {!webapp.isActive && '(Inactive)'}
        </option>
      ))}
    </select>
  );
}

// Webapp info display component
interface WebappInfoProps {
  showDetails?: boolean;
  className?: string;
}

export function WebappInfo({ showDetails = false, className }: WebappInfoProps) {
  const { currentWebapp, isLoading } = useWebapp();

  if (isLoading) {
    return <div className={className}>Loading...</div>;
  }

  if (!currentWebapp) {
    return <div className={className}>No webapp selected</div>;
  }

  if (!showDetails) {
    return (
      <div className={className}>
        <span className="font-medium">{currentWebapp.businessName}</span>
        {!currentWebapp.isActive && (
          <span className="ml-2 text-sm text-red-600">(Inactive)</span>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="font-medium text-lg">{currentWebapp.businessName}</h3>
      {currentWebapp.tagline && (
        <p className="text-sm text-gray-600">{currentWebapp.tagline}</p>
      )}
      <div className="mt-2 space-y-1 text-sm">
        <p><strong>Key:</strong> {currentWebapp.webappKey}</p>
        {currentWebapp.subdomain && (
          <p><strong>Subdomain:</strong> {currentWebapp.subdomain}</p>
        )}
        <p><strong>Status:</strong> {currentWebapp.isActive ? 'Active' : 'Inactive'}</p>
      </div>
    </div>
  );
}

// Utility function to get webapp key from URL subdomain
export function getWebappKeyFromSubdomain(): string | null {
  if (typeof window === 'undefined') return null;
  
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Check if it's a subdomain (more than 2 parts)
  if (parts.length > 2) {
    return parts[0]; // Return subdomain as webapp key
  }
  
  return null;
}

// Utility function to get webapp key from URL params
export function getWebappKeyFromParams(): string | null {
  if (typeof window === 'undefined') return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('webapp') || urlParams.get('w');
}

// Combined utility to determine webapp key from various sources
export function determineWebappKey(): string | null {
  return getWebappKeyFromSubdomain() || 
         getWebappKeyFromParams() ||
         (typeof window !== 'undefined' ? localStorage.getItem('current-webapp-key') : null);
}