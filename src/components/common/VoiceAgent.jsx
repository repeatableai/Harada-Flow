/**
 * DCE Voice Assistant
 *
 * Custom floating mic button using ElevenLabs React SDK.
 * Uses server-side signed URL for authenticated sessions.
 * No ElevenLabs branding.
 */

import React, { useState, useCallback } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function VoiceAgentButton() {
  const [error, setError] = useState(null);

  const conversation = useConversation({
    onConnect: () => setError(null),
    onDisconnect: () => {},
    onError: (err) => {
      console.error('Voice agent error:', err);
      setError('Connection failed');
      setTimeout(() => setError(null), 3000);
    },
  });

  const isConnected = conversation.status === 'connected';
  const isConnecting = conversation.status === 'connecting';

  const handleClick = useCallback(async () => {
    if (isConnected) {
      await conversation.endSession();
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Get signed URL from backend
        const tokenResponse = await fetch(`${API_BASE}/voice/token`);
        if (!tokenResponse.ok) {
          throw new Error('Failed to get voice token');
        }
        const { signed_url } = await tokenResponse.json();

        if (signed_url) {
          await conversation.startSession({ signedUrl: signed_url });
        } else {
          // Fallback to public agent ID
          await conversation.startSession({
            agentId: 'agent_5501kpehtkcxfhkvp3bqp38j238s',
          });
        }
      } catch (err) {
        console.error('Voice agent start error:', err);
        if (err.name === 'NotAllowedError') {
          setError('Microphone access denied');
        } else {
          setError(err.message || 'Failed to connect');
        }
        setTimeout(() => setError(null), 3000);
      }
    }
  }, [isConnected, conversation]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {error && (
        <div className="bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          {error}
        </div>
      )}
      {isConnected && (
        <div className="bg-slate-800/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${conversation.isSpeaking ? 'bg-green-400 animate-pulse' : 'bg-blue-400'}`} />
          {conversation.isSpeaking ? 'Speaking...' : 'Listening...'}
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={isConnecting}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${
          isConnected
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : isConnecting
              ? 'bg-blue-500 text-white cursor-wait'
              : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
        }`}
        title={isConnected ? 'End conversation' : 'Talk to DCE Assistant'}
      >
        {isConnecting ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : isConnected ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}

export default function VoiceAgent() {
  return (
    <ConversationProvider>
      <VoiceAgentButton />
    </ConversationProvider>
  );
}
