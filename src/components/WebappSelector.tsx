'use client';

import React, { useState } from 'react';
import { ChevronDown, Building, Globe, Check } from 'lucide-react';
import { useWebapp } from '@/lib/webapp-context';

interface WebappSelectorProps {
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export default function WebappSelector({ 
  className = '', 
  showLabel = true,
  compact = false 
}: WebappSelectorProps) {
  const { currentWebapp, webapps, switchWebapp, isLoading } = useWebapp();
  const [isOpen, setIsOpen] = useState(false);

  const handleWebappSelect = async (webappKey: string) => {
    try {
      await switchWebapp(webappKey);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch webapp:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!currentWebapp || webapps.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No webapps available
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {showLabel && !compact && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Current Webapp
        </label>
      )}
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-lg
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            transition-colors duration-150
            ${compact ? 'text-sm' : ''}
          `}
        >
          <div className="flex items-center space-x-2 min-w-0">
            <Building className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-gray-400 flex-shrink-0`} />
            <div className="text-left min-w-0">
              <div className={`font-medium text-gray-900 truncate ${compact ? 'text-sm' : ''}`}>
                {currentWebapp.businessName}
              </div>
              {!compact && (
                <div className="text-xs text-gray-500 flex items-center space-x-2">
                  <span>{currentWebapp.webappKey}</span>
                  {currentWebapp.subdomain && (
                    <>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        <Globe className="w-3 h-3" />
                        <span>{currentWebapp.subdomain}</span>
                      </span>
                    </>
                  )}
                  {!currentWebapp.isActive && (
                    <>
                      <span>•</span>
                      <span className="text-red-500">Inactive</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
            <div className="py-1">
              {webapps.map((webapp) => (
                <button
                  key={webapp.webappKey}
                  onClick={() => handleWebappSelect(webapp.webappKey)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between
                    transition-colors duration-150
                    ${webapp.webappKey === currentWebapp.webappKey ? 'bg-blue-50' : ''}
                  `}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className={`font-medium truncate ${
                        webapp.webappKey === currentWebapp.webappKey 
                          ? 'text-blue-900' 
                          : 'text-gray-900'
                      }`}>
                        {webapp.businessName}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center space-x-2">
                        <span>{webapp.webappKey}</span>
                        {webapp.subdomain && (
                          <>
                            <span>•</span>
                            <span>{webapp.subdomain}</span>
                          </>
                        )}
                        {!webapp.isActive && (
                          <>
                            <span>•</span>
                            <span className="text-red-500">Inactive</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {webapp.webappKey === currentWebapp.webappKey && (
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            
            {webapps.length > 1 && (
              <div className="border-t border-gray-100 px-3 py-2">
                <div className="text-xs text-gray-500">
                  {webapps.length} webapp{webapps.length !== 1 ? 's' : ''} total
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Compact variant for headers and toolbars
export function CompactWebappSelector({ className = '' }: { className?: string }) {
  return (
    <WebappSelector 
      className={className}
      showLabel={false}
      compact={true}
    />
  );
}

// Status indicator component
export function WebappStatusIndicator({ className = '' }: { className?: string }) {
  const { currentWebapp, isLoading } = useWebapp();

  if (isLoading || !currentWebapp) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${
        currentWebapp.isActive ? 'bg-green-500' : 'bg-red-500'
      }`} />
      <span className="text-sm text-gray-600">
        {currentWebapp.isActive ? 'Active' : 'Inactive'}
      </span>
    </div>
  );
}