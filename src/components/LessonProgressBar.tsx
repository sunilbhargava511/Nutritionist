'use client';

import React from 'react';
import { Check, Circle, PlayCircle, MessageCircle, Volume2 } from 'lucide-react';

export type LessonPhase = 'intro' | 'video' | 'qa';

interface LessonProgressBarProps {
  currentPhase: LessonPhase;
  introCompleted: boolean;
  videoCompleted: boolean;
  videoDuration?: number; // in seconds
  introDuration?: number; // in seconds
  className?: string;
}

export default function LessonProgressBar({
  currentPhase,
  introCompleted,
  videoCompleted,
  videoDuration,
  introDuration,
  className = ''
}: LessonProgressBarProps) {
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseIcon = (phase: LessonPhase, isCompleted: boolean, isActive: boolean) => {
    if (isCompleted) {
      return <Check className="w-5 h-5" />;
    }
    
    switch (phase) {
      case 'intro':
        return <Volume2 className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />;
      case 'video':
        return <PlayCircle className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />;
      case 'qa':
        return <MessageCircle className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />;
      default:
        return <Circle className="w-5 h-5" />;
    }
  };

  const getPhaseColor = (isCompleted: boolean, isActive: boolean, isPending: boolean) => {
    if (isCompleted) return 'text-green-600 bg-green-50 border-green-300';
    if (isActive) return 'text-blue-600 bg-blue-50 border-blue-400';
    if (isPending) return 'text-gray-400 bg-gray-50 border-gray-300';
    return 'text-gray-400 bg-gray-50 border-gray-300';
  };

  const getProgressBarColor = (isCompleted: boolean, isActive: boolean) => {
    if (isCompleted) return 'bg-green-500';
    if (isActive) return 'bg-blue-500';
    return 'bg-gray-300';
  };

  const phases = [
    {
      id: 'intro',
      label: 'Introduction',
      duration: introDuration,
      isCompleted: introCompleted,
      isActive: currentPhase === 'intro',
      isPending: currentPhase === 'intro' ? false : !introCompleted
    },
    {
      id: 'video',
      label: 'Video Lesson',
      duration: videoDuration,
      isCompleted: videoCompleted,
      isActive: currentPhase === 'video',
      isPending: currentPhase === 'intro' || (!introCompleted && !videoCompleted)
    },
    {
      id: 'qa',
      label: 'Q&A Discussion',
      duration: null, // Open-ended
      isCompleted: false,
      isActive: currentPhase === 'qa',
      isPending: currentPhase !== 'qa'
    }
  ];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {/* Progress Bar Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Lesson Progress</h3>
        <div className="text-xs text-gray-500">
          {currentPhase === 'intro' && 'Listen to the introduction'}
          {currentPhase === 'video' && 'Watch the educational video'}
          {currentPhase === 'qa' && 'Discuss what you learned'}
        </div>
      </div>

      {/* Progress Phases */}
      <div className="relative">
        {/* Connection Lines */}
        <div className="absolute top-6 left-0 right-0 flex items-center px-8">
          <div className="flex-1 h-0.5 bg-gray-200"></div>
          <div className="flex-1 h-0.5 bg-gray-200 mx-16"></div>
        </div>

        {/* Phase Indicators */}
        <div className="relative flex items-center justify-between">
          {phases.map((phase, index) => (
            <div key={phase.id} className="flex flex-col items-center flex-1">
              {/* Phase Circle */}
              <div
                className={`
                  relative z-10 w-12 h-12 rounded-full border-2 flex items-center justify-center
                  transition-all duration-300
                  ${getPhaseColor(phase.isCompleted, phase.isActive, phase.isPending)}
                `}
              >
                {getPhaseIcon(phase.id as LessonPhase, phase.isCompleted, phase.isActive)}
                
                {/* Active Pulse Ring */}
                {phase.isActive && (
                  <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-50"></div>
                )}
              </div>

              {/* Phase Label */}
              <div className="mt-2 text-center">
                <div className={`text-sm font-medium ${
                  phase.isCompleted ? 'text-green-700' :
                  phase.isActive ? 'text-blue-700' :
                  'text-gray-500'
                }`}>
                  {phase.label}
                </div>
                
                {/* Duration */}
                {phase.duration && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatDuration(phase.duration)}
                  </div>
                )}
                {phase.id === 'qa' && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    Open Discussion
                  </div>
                )}
              </div>

              {/* Progress Line Overlay */}
              {index < phases.length - 1 && (
                <div 
                  className={`
                    absolute top-6 left-1/2 w-full h-0.5 z-0
                    ${phase.isCompleted ? 'bg-green-500' : 'bg-transparent'}
                  `}
                  style={{ width: 'calc(100% - 3rem)' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status Message */}
      <div className="mt-4 flex items-center justify-center">
        <div className={`
          inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
          ${currentPhase === 'intro' ? 'bg-blue-100 text-blue-700' :
            currentPhase === 'video' ? 'bg-purple-100 text-purple-700' :
            'bg-green-100 text-green-700'}
        `}>
          {currentPhase === 'intro' && (
            <>
              <Volume2 className="w-3 h-3 animate-pulse" />
              Introduction Playing
            </>
          )}
          {currentPhase === 'video' && (
            <>
              <PlayCircle className="w-3 h-3" />
              Video in Progress
            </>
          )}
          {currentPhase === 'qa' && (
            <>
              <MessageCircle className="w-3 h-3" />
              Q&A Session Active
            </>
          )}
        </div>
      </div>
    </div>
  );
}