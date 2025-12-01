import React, { useRef, useEffect, useState } from 'react';
import { ChatState, Persona, Sender } from '../types';

interface BotColumnProps {
  persona: Persona;
  chatState: ChatState;
}

const BotColumn: React.FC<BotColumnProps> = ({ persona, chatState }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBio, setShowBio] = useState(false);

  // Auto-scroll to bottom when messages change or while typing
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatState.messages, chatState.status]);

  const isActive = ['thinking', 'streaming'].includes(chatState.status);

  return (
    <div className="flex flex-col h-full min-w-[320px] max-w-[400px] border-r border-gray-800 bg-gray-900/50 flex-1 snap-center transition-colors duration-500 relative group">
      {/* Header */}
      <div 
        className={`p-4 border-b border-gray-800 flex items-center space-x-3 bg-gray-900 sticky top-0 z-20 cursor-help transition-colors hover:bg-gray-800/80`}
        onMouseEnter={() => setShowBio(true)}
        onMouseLeave={() => setShowBio(false)}
        onClick={() => setShowBio(!showBio)}
      >
        {/* Avatar Area */}
        <div className={`relative w-12 h-12 flex-none rounded-full shadow-lg transition-all duration-300 ${isActive ? 'scale-110 ring-2 ring-white/20' : ''}`}>
           <div className={`w-full h-full rounded-full flex items-center justify-center text-sm font-bold ${persona.color} transition-all duration-500 ${isActive ? 'grayscale-0' : 'grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-100'}`}>
             {persona.avatarInitials}
           </div>
           
           {/* Activity Badge */}
           {isActive && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 border-2 border-gray-900"></span>
              </span>
           )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-100 text-sm flex items-center gap-2">
            <span className="truncate">{persona.name}</span>
          </h3>
          <p className="text-xs text-gray-400 uppercase tracking-wider truncate">{persona.title}</p>
        </div>
        {/* Info Icon */}
        <div className="text-gray-600">
           <svg className={`w-4 h-4 transition-colors ${showBio ? 'text-indigo-400' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
           </svg>
        </div>
      </div>

      {/* Bio Overlay */}
      <div 
        className={`absolute top-[80px] left-0 w-full bg-gray-900/95 backdrop-blur-md border-b border-gray-700 p-4 z-20 shadow-2xl transition-all duration-300 origin-top transform ${showBio ? 'opacity-100 scale-y-100 translate-y-0' : 'opacity-0 scale-y-95 -translate-y-2 pointer-events-none'}`}
      >
        <div className="flex items-start space-x-3">
           <div className="flex-1 text-xs text-gray-300 leading-relaxed font-sans">
              <h4 className="font-bold text-gray-100 mb-1 uppercase tracking-wide text-[10px] opacity-70">About this Persona</h4>
              {persona.bio}
           </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {chatState.messages.map((msg, index) => {
          const isLastAndStreaming = chatState.status === 'streaming' && index === chatState.messages.length - 1 && msg.sender === Sender.BOT;
          
          return (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.sender === Sender.USER ? 'items-end' : 'items-start'}`}
            >
              <div 
                className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm
                  ${msg.sender === Sender.USER 
                    ? 'bg-gray-750 text-gray-100 rounded-br-none' 
                    : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'
                  }`}
              >
                {msg.text}
                {isLastAndStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 animate-pulse align-middle rounded-sm" />
                )}
              </div>
              <span className="text-[10px] text-gray-500 mt-1 px-1">
                {msg.sender === Sender.USER ? 'You' : persona.name}
              </span>
            </div>
          );
        })}
        
        {/* Status Indicators */}
        {(chatState.status === 'queued' || chatState.status === 'thinking') && (
          <div className="flex items-start animate-pulse">
            <div className="bg-gray-800/50 rounded-2xl rounded-bl-none px-4 py-3 border border-gray-700/50">
              {chatState.status === 'queued' ? (
                <div className="flex items-center space-x-2 text-xs text-gray-500 font-mono">
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Waiting to speak...</span>
                </div>
              ) : (
                <div className="flex space-x-1 h-4 items-center">
                   <span className="text-xs text-gray-400 mr-2 font-mono">Thinking</span>
                   <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                   <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                   <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-300"></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BotColumn;