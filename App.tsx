import React, { useState, useRef } from 'react';
import { PERSONAS, INITIAL_GREETING } from './constants';
import { ChatState, Sender } from './types';
import BotColumn from './components/BotColumn';
import { streamBotResponse } from './services/geminiService';

const App: React.FC = () => {
  // Initialize state for all bots
  const [chats, setChats] = useState<Map<string, ChatState>>(() => {
    const map = new Map<string, ChatState>();
    PERSONAS.forEach(p => {
      map.set(p.id, {
        personaId: p.id,
        messages: [{
          id: 'init-' + p.id,
          text: p.greeting || INITIAL_GREETING,
          sender: Sender.BOT,
          timestamp: Date.now()
        }],
        status: 'idle'
      });
    });
    return map;
  });

  // Track active personas
  const [activePersonaIds, setActivePersonaIds] = useState<Set<string>>(() => 
    new Set(PERSONAS.map(p => p.id))
  );
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Scroll horizontal container on wheel to help desktop users with horizontal layout
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const togglePersona = (id: string) => {
    setActivePersonaIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        // Prevent removing the last one
        if (newSet.size > 1) {
          newSet.delete(id);
        }
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userText = input.trim();
    setInput('');
    setIsProcessing(true);

    const timestamp = Date.now();
    const messageId = `msg-${timestamp}`;

    // Filter to only active personas
    const activePersonas = PERSONAS.filter(p => activePersonaIds.has(p.id));

    // 1. Add user message and set status to QUEUED for all active bots
    setChats(prev => {
      const newChats = new Map<string, ChatState>(prev);
      activePersonas.forEach(p => {
        const currentChat = newChats.get(p.id)!;
        newChats.set(p.id, {
          ...currentChat,
          messages: [
            ...currentChat.messages,
            { id: messageId, text: userText, sender: Sender.USER, timestamp }
          ],
          status: 'queued'
        });
      });
      return newChats;
    });

    // 2. Trigger API calls for ACTIVE bots with independent error handling
    const promises = activePersonas.map(async (persona, index) => {
      const responseId = `resp-${persona.id}-${timestamp}`;
      let hasReceivedContent = false;

      try {
        // Stagger delay: 2000ms * index. 
        // Increased from 1000ms to 2000ms to allow more breathing room for the API
        // and reduce the chance of 429 Rate Limit errors when all 5 bots are active.
        await new Promise(resolve => setTimeout(resolve, index * 2000));

        // Update status to THINKING
        setChats(prev => {
          const newChats = new Map<string, ChatState>(prev);
          const chat = newChats.get(persona.id);
          if (chat) {
              newChats.set(persona.id, { ...chat, status: 'thinking' });
          }
          return newChats;
        });
      
        // Get current history from the render scope closure (before user msg was added to state, 
        // so we manually append it for the prompt)
        const currentChatState = chats.get(persona.id);
        const historyWithUserMsg = [
            ...(currentChatState?.messages || []),
            { id: messageId, text: userText, sender: Sender.USER, timestamp }
        ];

        await streamBotResponse(persona, historyWithUserMsg, (partialText) => {
           hasReceivedContent = true;
           setChats(prev => {
             const newChats = new Map<string, ChatState>(prev);
             const chat = newChats.get(persona.id);
             if (!chat) return prev;
             
             // Transition status to 'streaming' as soon as we get the first chunk of text
             const currentStatus = (chat.status === 'thinking' || chat.status === 'queued') 
                ? 'streaming' 
                : chat.status;

             const msgIndex = chat.messages.findIndex(m => m.id === responseId);
             let newMessages = [...chat.messages];
             
             if (msgIndex >= 0) {
               newMessages[msgIndex] = { ...newMessages[msgIndex], text: partialText };
             } else {
               newMessages.push({
                 id: responseId,
                 text: partialText,
                 sender: Sender.BOT,
                 timestamp: Date.now()
               });
             }

             newChats.set(persona.id, {
               ...chat,
               messages: newMessages,
               status: currentStatus
             });
             return newChats;
           });
        });

        // Failsafe: If stream finished without any content and no error was thrown
        // Note: The service now handles retries, so if we get here with no content, it's a hard fail.
        if (!hasReceivedContent) {
           throw new Error("No response content received");
        }

      } catch (err) {
        console.error(`Failed to get response for ${persona.id}`, err);
        
        // Inject explicit error message if none exists
        setChats(prev => {
            const newChats = new Map<string, ChatState>(prev);
            const chat = newChats.get(persona.id);
            if (!chat) return prev;
            
            // Check if we already have a message (maybe the service caught an error and sent text)
            const existingMsg = chat.messages.find(m => m.id === responseId);
            if (!existingMsg) {
                newChats.set(persona.id, {
                    ...chat,
                    messages: [
                        ...chat.messages,
                        { 
                            id: responseId, 
                            text: "*[System Error: Connection failed. This expert is currently unavailable.]*", 
                            sender: Sender.BOT, 
                            timestamp: Date.now() 
                        }
                    ]
                });
            }
            return newChats;
        });
      } finally {
        // Always reset status to IDLE
        setChats(prev => {
            const newChats = new Map<string, ChatState>(prev);
            const chat = newChats.get(persona.id);
            if (chat) {
                newChats.set(persona.id, { ...chat, status: 'idle' });
            }
            return newChats;
        });
      }
    });

    // Wait for all bots to finish (successfully or with errors)
    await Promise.all(promises);
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans selection:bg-purple-500/30">
      
      {/* Header */}
      <header className="h-16 flex-none border-b border-gray-800 bg-gray-950 flex items-center px-6 justify-between z-20 shadow-xl relative">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">The AI Council</h1>
            <h1 className="text-xl font-bold tracking-tight text-white sm:hidden">AI Council</h1>
            <p className="text-xs text-gray-500 font-mono hidden sm:block">Simulated Expert Panel • v1.0</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
            {/* Status Indicators */}
            <div className="hidden lg:flex space-x-4 text-xs font-mono text-gray-500 border-r border-gray-800 pr-4">
                <span>Secure Context</span>
                <span className="text-gray-700">|</span>
                <span>Gemini 2.5 Flash</span>
                <span className="text-gray-700">|</span>
                <span className={isProcessing ? "text-indigo-400 animate-pulse" : "text-gray-500"}>
                    {isProcessing ? 'SESSION ACTIVE' : 'READY'}
                </span>
            </div>
            
            {/* Config Menu */}
            <div className="relative z-30">
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        isMenuOpen 
                            ? 'bg-gray-800 text-white border-gray-600 ring-1 ring-gray-700' 
                            : 'bg-gray-900 text-gray-300 border-gray-700 hover:bg-gray-800'
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Members ({activePersonaIds.size})</span>
                    <svg className={`w-3 h-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                
                {isMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-20 cursor-default" onClick={() => setIsMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-72 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-30 overflow-hidden ring-1 ring-black/50">
                            <div className="p-3 border-b border-gray-800 bg-gray-900/95 backdrop-blur flex justify-between items-center">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Panelists</h3>
                                <span className="text-[10px] text-gray-600">Select to show/hide</span>
                            </div>
                            <div className="max-h-[60vh] overflow-y-auto p-1">
                                {PERSONAS.map(p => {
                                    const isActive = activePersonaIds.has(p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => togglePersona(p.id)}
                                            className={`w-full flex items-center space-x-3 p-2.5 rounded-lg text-left transition-all border border-transparent ${
                                                isActive ? 'bg-gray-800/80 text-gray-100 border-gray-700/50' : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 flex-none rounded-full flex items-center justify-center text-[10px] font-bold transition-all overflow-hidden ${isActive ? p.color + ' text-white' : 'bg-gray-800 text-gray-600'}`}>
                                               {p.avatarInitials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-gray-500'}`}>{p.name}</div>
                                                <div className="text-[10px] opacity-70 truncate">{p.title}</div>
                                            </div>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                                                isActive ? 'bg-indigo-600 border-indigo-600' : 'border-gray-700 bg-gray-900'
                                            }`}>
                                                {isActive && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
      </header>

      {/* Main Panel Area */}
      <main 
        className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
        ref={scrollContainerRef}
      >
        {PERSONAS.filter(p => activePersonaIds.has(p.id)).map(persona => (
          <BotColumn 
            key={persona.id}
            persona={persona}
            chatState={chats.get(persona.id)!}
          />
        ))}

        {/* Add Panelist Column - Visible when not all personas are active */}
        {activePersonaIds.size < PERSONAS.length && (
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex-none min-w-[120px] border-r border-dashed border-gray-800 bg-gray-900/20 hover:bg-gray-900/40 hover:border-gray-700 transition-all flex flex-col items-center justify-center group"
          >
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-700 group-hover:border-gray-500 group-hover:bg-gray-800 flex items-center justify-center text-gray-600 group-hover:text-gray-300 transition-all">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <span className="mt-3 text-xs font-semibold text-gray-600 group-hover:text-gray-400 uppercase tracking-widest">Add Member</span>
          </button>
        )}
        
        {/* Fill empty space if few personas selected */}
        <div className="flex-1 min-w-[50px] bg-gray-950" />
      </main>

      {/* Input Area */}
      <footer className="flex-none p-4 md:p-6 bg-gray-950 border-t border-gray-800">
        <div className="max-w-4xl mx-auto w-full relative">
          <form onSubmit={handleSend} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
            <div className="relative flex items-center bg-gray-900 rounded-xl overflow-hidden shadow-2xl ring-1 ring-gray-800">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the council about the history, state, or future of AI..."
                className="w-full bg-transparent border-0 px-6 py-4 text-gray-100 placeholder-gray-500 focus:ring-0 focus:outline-none font-medium"
                disabled={isProcessing}
              />
              <button
                type="submit"
                disabled={!input.trim() || isProcessing}
                className="px-6 py-2 m-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Processing</span>
                  </>
                ) : (
                  <span>Broadcast</span>
                )}
              </button>
            </div>
          </form>
          <div className="mt-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              All views are AI-generated simulations.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;