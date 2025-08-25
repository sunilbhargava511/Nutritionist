'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Eye, 
  Globe, 
  Building, 
  Save,
  X,
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { useWebapp } from '@/lib/webapp-context';
import { Webapp } from '@/lib/database/schema';

interface WebappManagementProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function WebappManagement({ onSuccess, onError }: WebappManagementProps) {
  const { webapps, currentWebapp, switchWebapp, createWebapp, updateWebapp, deleteWebapp } = useWebapp();
  const [editingWebapp, setEditingWebapp] = useState<Webapp | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<Webapp>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when editing
  const startEditing = (webapp: Webapp) => {
    setEditingWebapp(webapp);
    setFormData(webapp);
    setIsCreating(false);
  };

  // Start creating new webapp
  const startCreating = (templateWebapp?: Webapp) => {
    setIsCreating(true);
    setEditingWebapp(null);
    
    if (templateWebapp) {
      // Copy template data but reset key fields
      setFormData({
        ...templateWebapp,
        id: '',
        webappKey: '',
        businessName: `${templateWebapp.businessName} (Copy)`,
        subdomain: '',
        customDomain: ''
      });
    } else {
      // Fresh webapp
      setFormData({
        webappKey: '',
        businessName: '',
        serviceDescription: '',
        keyBenefits: '',
        address: '',
        phoneNumber: '',
        email: '',
        website: '',
        lessonsName: 'Lessons',
        lessonsDescription: 'Educational video content',
        conversationName: 'Chat',
        conversationDescription: 'Open conversation with AI',
        theme: 'light',
        isActive: true
      });
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingWebapp(null);
    setIsCreating(false);
    setFormData({});
  };

  // Handle form input changes
  const handleInputChange = (field: keyof Webapp, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Submit form (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.webappKey || !formData.businessName) {
      onError?.('Webapp key and business name are required');
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (isCreating) {
        await createWebapp(formData);
        onSuccess?.('Webapp created successfully');
      } else if (editingWebapp) {
        await updateWebapp(editingWebapp.webappKey, formData);
        onSuccess?.('Webapp updated successfully');
      }
      
      cancelEditing();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to save webapp');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete webapp
  const handleDelete = async (webapp: Webapp) => {
    if (!confirm(`Are you sure you want to delete "${webapp.businessName}"? This will permanently delete all associated data.`)) {
      return;
    }

    try {
      await deleteWebapp(webapp.webappKey);
      onSuccess?.('Webapp deleted successfully');
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to delete webapp');
    }
  };

  // Switch to webapp
  const handleSwitchTo = async (webapp: Webapp) => {
    try {
      await switchWebapp(webapp.webappKey);
      onSuccess?.(`Switched to ${webapp.businessName}`);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to switch webapp');
    }
  };

  // Show form (editing or creating)
  if (editingWebapp || isCreating) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {isCreating ? 'Create New Webapp' : `Edit ${editingWebapp?.businessName}`}
          </h2>
          <button
            onClick={cancelEditing}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
          {/* Basic Information */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Webapp Key *
                </label>
                <input
                  type="text"
                  value={formData.webappKey || ''}
                  onChange={(e) => handleInputChange('webappKey', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="unique-webapp-key"
                  disabled={!isCreating} // Can't change key after creation
                />
                <p className="text-xs text-gray-500 mt-1">
                  Unique identifier for this webapp (cannot be changed after creation)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={formData.businessName || ''}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your Business Name"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Description
                </label>
                <textarea
                  value={formData.serviceDescription || ''}
                  onChange={(e) => handleInputChange('serviceDescription', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe your services..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Benefits
                </label>
                <textarea
                  value={formData.keyBenefits || ''}
                  onChange={(e) => handleInputChange('keyBenefits', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="List key benefits of your services..."
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber || ''}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@yourbusiness.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website || ''}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://yourbusiness.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Main St, City, State 12345"
                />
              </div>
            </div>
          </div>

          {/* Page Configuration */}
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Page Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lessons Page Name
                </label>
                <input
                  type="text"
                  value={formData.lessonsName || 'Lessons'}
                  onChange={(e) => handleInputChange('lessonsName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Conversation Page Name
                </label>
                <input
                  type="text"
                  value={formData.conversationName || 'Chat'}
                  onChange={(e) => handleInputChange('conversationName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subdomain
                </label>
                <input
                  type="text"
                  value={formData.subdomain || ''}
                  onChange={(e) => handleInputChange('subdomain', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="subdomain (for subdomain.yourdomain.com)"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive || false}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={cancelEditing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : (isCreating ? 'Create Webapp' : 'Update Webapp')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Show webapp list
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Webapp Management</h2>
        <button
          onClick={() => startCreating()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>New Webapp</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {webapps.map((webapp) => (
          <div
            key={webapp.webappKey}
            className={`bg-white border rounded-lg p-6 ${
              currentWebapp?.webappKey === webapp.webappKey 
                ? 'border-blue-500 ring-2 ring-blue-100' 
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {webapp.businessName}
                  </h3>
                  {currentWebapp?.webappKey === webapp.webappKey && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                  <span>Key: {webapp.webappKey}</span>
                  {webapp.subdomain && (
                    <>
                      <span>•</span>
                      <Globe className="w-4 h-4" />
                      <span>{webapp.subdomain}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    webapp.isActive ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className={`text-sm ${
                    webapp.isActive ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {webapp.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {webapp.serviceDescription && (
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                {webapp.serviceDescription}
              </p>
            )}

            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                {currentWebapp?.webappKey !== webapp.webappKey && (
                  <button
                    onClick={() => handleSwitchTo(webapp)}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Switch To</span>
                  </button>
                )}
                {webapp.website && (
                  <a
                    href={webapp.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Visit</span>
                  </a>
                )}
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => startEditing(webapp)}
                  className="p-1.5 text-gray-400 hover:text-blue-600"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => startCreating(webapp)}
                  className="p-1.5 text-gray-400 hover:text-green-600"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(webapp)}
                  className="p-1.5 text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {webapps.length === 0 && (
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No webapps found</h3>
          <p className="text-gray-500 mb-6">Create your first webapp to get started.</p>
          <button
            onClick={() => startCreating()}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Create Webapp</span>
          </button>
        </div>
      )}
    </div>
  );
}