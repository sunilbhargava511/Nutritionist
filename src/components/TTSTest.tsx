'use client';

import React, { useState } from 'react';

export default function TTSTest() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('Ready');

  const testTTS = () => {
    setStatus('Starting TTS...');
    setIsPlaying(true);

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Hello! This is a test of the text to speech system. Can you hear me?');
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => {
        console.log('TTS started successfully');
        setStatus('Playing...');
      };
      
      utterance.onend = () => {
        console.log('TTS completed');
        setStatus('Completed');
        setIsPlaying(false);
      };
      
      utterance.onerror = (event) => {
        console.error('TTS error:', event);
        setStatus('Error: ' + event.error);
        setIsPlaying(false);
      };
      
      console.log('Starting speech synthesis...');
      window.speechSynthesis.speak(utterance);
    } else {
      setStatus('Speech synthesis not supported');
      setIsPlaying(false);
    }
  };

  return (
    <div className="p-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl shadow-lg">
      <h3 className="text-xl font-bold text-yellow-800 mb-3">🔊 TTS Test Component</h3>
      <p className="text-yellow-700 mb-4 text-lg">Status: <span className="font-semibold">{status}</span></p>
      <button
        onClick={testTTS}
        disabled={isPlaying}
        className="px-6 py-3 text-lg bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-yellow-400 transition-colors"
      >
        {isPlaying ? '🔊 Playing...' : '🎤 Test Browser TTS'}
      </button>
      <p className="text-sm text-yellow-600 mt-3">
        Click this button to test if text-to-speech works in your browser
      </p>
    </div>
  );
}