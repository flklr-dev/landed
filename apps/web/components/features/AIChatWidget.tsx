'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User, CheckCircle2, ArrowRight, CornerDownLeft, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  actionResult?: {
    type: 'status_updated' | 'job_extracted';
    company: string;
    title?: string;
    status?: string;
  };
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'm-1',
    sender: 'ai',
    text: "Hi! I'm your Landed AI Assistant. You can paste a job URL here to extract details, or type natural language updates like 'Got rejected from Notion' or 'Applied to Stripe'.",
    timestamp: 'Just now',
  },
];

const SUGGESTED_PROMPTS = [
  'Applied to Google for Frontend Lead',
  'Got rejected from Notion',
  'Moved Vercel to Interview',
  'https://jobs.lever.co/vercel/frontend-engineer',
];

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    // Simulate AI Intent Recognition / Natural Language Processing
    setTimeout(() => {
      let aiResponseText = '';
      let actionResult: ChatMessage['actionResult'] = undefined;

      const lower = text.toLowerCase();

      if (text.startsWith('http://') || text.startsWith('https://')) {
        // URL extraction intent
        const domainMatch = text.match(/https?:\/\/(?:www\.)?([^/]+)/);
        const domain = domainMatch ? domainMatch[1] : 'web';
        const companyName = domain.split('.')[0];
        const formattedCompany = companyName.charAt(0).toUpperCase() + companyName.slice(1);

        aiResponseText = `I've fetched and extracted the job posting from ${domain}. Added to your Saved list!`;
        actionResult = {
          type: 'job_extracted',
          company: formattedCompany,
          title: 'Software Engineer',
          status: 'saved',
        };
      } else if (lower.includes('reject') || lower.includes('rejected')) {
        // Status: Rejected intent
        const companyMatch = text.match(/(?:from|by|at)\s+([A-Za-z0-9\s]+)/i) || text.match(/([A-Za-z0-9]+)\s+got\s+rejected/i);
        const company = companyMatch ? companyMatch[1].trim() : 'Notion';

        aiResponseText = `Got it. I've updated the status for ${company} to Rejected. Keep going — your next match is right around the corner!`;
        actionResult = {
          type: 'status_updated',
          company: company,
          status: 'rejected',
        };
      } else if (lower.includes('interview') || lower.includes('2nd round') || lower.includes('final round')) {
        // Status: Interview intent
        const companyMatch = text.match(/(?:with|at|for)\s+([A-Za-z0-9\s]+)/i) || text.match(/([A-Za-z0-9]+)\s+to\s+interview/i);
        const company = companyMatch ? companyMatch[1].trim() : 'Vercel';

        aiResponseText = `Awesome news! Updated ${company} to Interview. Good luck with the preparation!`;
        actionResult = {
          type: 'status_updated',
          company: company,
          status: 'interview',
        };
      } else if (lower.includes('applied') || lower.includes('apply')) {
        // Status: Applied intent
        const companyMatch = text.match(/(?:to|at)\s+([A-Za-z0-9\s]+)/i);
        const company = companyMatch ? companyMatch[1].trim() : 'Google';

        aiResponseText = `Logged! Created application entry for ${company} and marked as Applied.`;
        actionResult = {
          type: 'status_updated',
          company: company,
          status: 'applied',
        };
      } else {
        aiResponseText = `I processed your update: "${text}". If this matches a tracked job, your board and table will automatically reflect the change.`;
      }

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiResponseText,
        timestamp: 'Just now',
        actionResult,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={[
          'fixed bottom-5 right-5 z-50',
          'h-12 px-4 rounded-full shadow-lg',
          'flex items-center gap-2.5',
          'transition-all duration-200 active:scale-95',
          isOpen
            ? 'bg-panel text-panel-fg border border-panel-fg/20'
            : 'bg-panel text-panel-fg hover:bg-panel/90 border border-signal/40',
        ].join(' ')}
        aria-label="Toggle AI Assistant Chat"
      >
        <div className="relative">
          <Sparkles size={18} className="text-signal animate-pulse-signal" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-signal" />
        </div>
        <span className="font-mono text-xs uppercase tracking-wider font-medium">
          {isOpen ? 'Close AI' : 'AI Assistant'}
        </span>
      </button>

      {/* Chat Drawer Popup */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-96 max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-7rem)] bg-panel text-panel-fg border border-panel-fg/15 shadow-2xl flex flex-col animate-fade-in-scale">
          {/* Header */}
          <div className="p-3.5 border-b border-panel-fg/10 flex items-center justify-between bg-panel">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-sm bg-signal/20 flex items-center justify-center">
                <Sparkles size={13} className="text-signal" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-semibold text-panel-fg uppercase tracking-wider">
                  Landed Assistant
                </h3>
                <p className="text-[10px] font-mono text-panel-fg/50">Natural language & URL intake</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-panel-fg/50 hover:text-panel-fg transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 font-mono text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="w-5 h-5 rounded-full bg-signal/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={11} className="text-signal" />
                  </div>
                )}

                <div
                  className={`max-w-[82%] p-2.5 rounded-sm ${
                    msg.sender === 'user'
                      ? 'bg-signal text-panel font-sans text-xs font-medium'
                      : 'bg-panel-fg/8 text-panel-fg/90 border border-panel-fg/10'
                  }`}
                >
                  <p className="leading-relaxed">{msg.text}</p>

                  {/* Action Confirmation Badge */}
                  {msg.actionResult && (
                    <div className="mt-2 pt-2 border-t border-panel-fg/10 flex items-center gap-1.5 text-[10px] text-green-400">
                      <CheckCircle2 size={11} className="shrink-0" />
                      <span>
                        Action: {msg.actionResult.company} ({msg.actionResult.status})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-panel-fg/40 text-xs italic">
                <Bot size={11} className="animate-spin text-signal" />
                Processing input…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Chips */}
          <div className="px-3 py-2 border-t border-panel-fg/10 bg-panel-fg/3 flex flex-nowrap overflow-x-auto gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="shrink-0 text-[9px] font-mono px-2 py-1 bg-panel-fg/8 hover:bg-panel-fg/15 text-panel-fg/70 border border-panel-fg/10 rounded-sm transition-colors text-left truncate max-w-[200px]"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-panel-fg/10 flex items-center gap-2 bg-panel"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste job link or type update..."
              className="flex-1 bg-panel-fg/5 text-panel-fg text-xs px-3 py-2 border border-panel-fg/15 rounded-sm placeholder:text-panel-fg/40 focus:outline-none focus:border-signal"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message to AI assistant"
              className="h-8 w-8 bg-signal text-panel rounded-sm flex items-center justify-center disabled:opacity-40 hover:bg-signal/90 transition-colors"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
