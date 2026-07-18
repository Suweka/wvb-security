'use client';

import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const GREETING: ChatMessage = {
  role: 'assistant',
  content: "Hi! I'm the White Vintage Bungalow virtual concierge. Ask me about rooms, pricing, amenities, or booking policies.",
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: 'user', content: text } as ChatMessage];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'The chatbot is temporarily unavailable.');
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-widget-entrance fixed bottom-24 right-6 z-50 flex flex-col items-end gap-3 opacity-0">
      {open && (
        <div className="w-[min(22rem,calc(100vw-3rem))] h-[28rem] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden glass-strong shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 bg-[#208f6a] text-white shrink-0">
            <span className="font-semibold text-sm">Virtual Concierge</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                <path d="M6.4 4.98 4.98 6.4 10.59 12l-5.61 5.6 1.42 1.42L12 13.41l5.6 5.61 1.42-1.42L13.41 12l5.61-5.6-1.42-1.42L12 10.59z" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-white/40 dark:bg-gray-900/30">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#208f6a] text-white rounded-br-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white dark:bg-gray-800 shadow-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                </div>
              </div>
            )}
            {error && <p className="text-xs text-red-600 dark:text-red-400 px-1">{error}</p>}
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 p-2 border-t border-gray-200/60 dark:border-white/10 bg-white/60 dark:bg-gray-900/40 shrink-0"
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about rooms, prices, policies..."
              className="flex-1 min-w-0 px-3 py-2 rounded-full text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#208f6a]/40"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-[#208f6a] text-white disabled:opacity-40 hover:bg-[#1a7356] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white -rotate-45 translate-x-[1px]">
                <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <div className="flex items-center gap-3 group">
        {/* "Ask our concierge" label — fades + slides in on hover, only while closed */}
        {!open && (
          <div className="pointer-events-none opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 ease-out">
            <div className="bg-white text-gray-800 dark:text-gray-200 text-sm font-semibold px-4 py-2 rounded-full shadow-lg border border-gray-100 whitespace-nowrap flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#208f6a] inline-block animate-pulse" />
              Ask our concierge
            </div>
          </div>
        )}

        <div className="relative flex-shrink-0">
          {!open && (
            <>
              {/* Outer pulse ring */}
              <span className="absolute inset-0 rounded-full bg-[#208f6a] animate-ping opacity-20" />
            </>
          )}
          {/* Inner glow ring */}
          <span className="absolute inset-[-3px] rounded-full bg-[#208f6a] opacity-15 group-hover:opacity-30 transition-opacity duration-300" />

          <button
            onClick={() => setOpen(v => !v)}
            aria-label={open ? 'Close chat' : 'Chat with our virtual concierge'}
            className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#25a87a] to-[#1a7356] shadow-[0_4px_20px_rgba(32,143,106,0.4)] hover:scale-110 hover:shadow-[0_6px_28px_rgba(32,143,106,0.55)] active:scale-95 transition-all duration-200 ease-out"
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white drop-shadow-sm">
                <path d="M6.4 4.98 4.98 6.4 10.59 12l-5.61 5.6 1.42 1.42L12 13.41l5.6 5.61 1.42-1.42L13.41 12l5.61-5.6-1.42-1.42L12 10.59z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white drop-shadow-sm">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.07L2 22l5.11-1.35A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-3.5 8.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm3.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm3.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z" />
              </svg>
            )}
          </button>

          {/* Small "AI" badge, top-right of the icon */}
          {!open && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-white dark:bg-gray-900 shadow border border-gray-100 dark:border-white/10">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-[#e5c466]">
                <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
