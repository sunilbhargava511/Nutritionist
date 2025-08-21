'use client';

import React from 'react';
import UnifiedSessionInterface from '@/components/UnifiedSessionInterface';

export default function TestUnifiedSessionPage() {
  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <div className="h-screen">
      <UnifiedSessionInterface onBack={handleBack} />
    </div>
  );
}