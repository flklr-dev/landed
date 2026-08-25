'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, Briefcase, CheckCircle2, Send, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { createJob, fetchJobs, quickUpdateJob } from '@/lib/api-client';
import type {
  Job,
  QuickUpdateProposedChanges,
  QuickUpdateResult,
} from '@landed/shared-types';

interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  result?: QuickUpdateResult;
  actionJob?: Job;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: 'Tell me about any application update — e.g. "Got an interview with Google" or "Applied to Stripe".',
  },
];

function normalizeCompanyName(company: string): string {
  return company
    .replace(/[,.]/g, ' ')
    .replace(
      /\b(?:incorporated|inc|limited|ltd|corporation|corp|company|co|llc|plc)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function shortestUniqueCompanyAlias(company: string, allCompanies: string[]): string {
  const normalized = normalizeCompanyName(company);
  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0) return company;

  const distinctCompanies = [...new Set(allCompanies.map(normalizeCompanyName))];
  for (let length = 1; length <= words.length; length += 1) {
    const alias = words.slice(0, length).join(' ');
    const aliasKey = alias.toLowerCase();
    const conflicts = distinctCompanies.filter((candidate) =>
      candidate.toLowerCase().startsWith(aliasKey),
    );
    if (conflicts.length === 1) return alias;
  }

  return normalized;
}

function buildSuggestedPrompts(jobs: Job[]): string[] {
  const companies = jobs.map((job) => job.company);
  const prompts = jobs.map((job) => {
    const company = shortestUniqueCompanyAlias(job.company, companies);
    switch (job.status) {
      case 'saved':
        return `Applied to ${company} for ${job.title}`;
      case 'applied':
        return `Interview with ${company} for ${job.title}`;
      case 'interview':
        return `Got an offer from ${company} for ${job.title}`;
      case 'offer':
      case 'rejected':
        return `Add note for ${company}: `;
    }
  });

  return [...new Set(prompts)].slice(0, 4);
}

function notifyJobChanged(type: 'updated' | 'created', job: Job) {
  window.dispatchEvent(
    new CustomEvent('landed:job-changed', {
      detail: { type, job },
    }),
  );
}

export function AIChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [handledMessages, setHandledMessages] = useState<Set<string>>(new Set());
  const [trackedJobs, setTrackedJobs] = useState<Job[]>([]);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestedPrompts = buildSuggestedPrompts(trackedJobs);

  // Auto-close on page navigation
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Auto-close on click outside & Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        widgetContainerRef.current &&
        !widgetContainerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Scroll to bottom & autofocus when opened
  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    inputRef.current?.focus();
  }, [messages, isOpen]);

  // Keyboard shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((prev) => !prev);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // Fetch tracked jobs when widget opens to seed suggestions
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    fetchJobs({ limit: 20 })
      .then((response) => {
        if (!cancelled) setTrackedJobs(response.jobs);
      })
      .catch(() => {
        if (!cancelled) setTrackedJobs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const appendAssistantMessage = (
    text: string,
    result?: QuickUpdateResult,
    actionJob?: Job,
  ) => {
    setMessages((current) => [
      ...current,
      {
        id: `assistant-${Date.now()}-${Math.random()}`,
        sender: 'assistant',
        text,
        result,
        actionJob,
      },
    ]);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || isProcessing) return;

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, sender: 'user', text },
    ]);
    setInput('');

    setIsProcessing(true);
    try {
      const result = await quickUpdateJob({ text });
      if (result.job && result.action === 'created') {
        notifyJobChanged('created', result.job);
        setTrackedJobs((current) => [result.job!, ...current]);
        appendAssistantMessage(result.message, result, result.job);
      } else if (result.job && (result.action === 'updated' || result.action === 'unchanged')) {
        if (result.action === 'updated') {
          notifyJobChanged('updated', result.job);
        }
        setTrackedJobs((current) =>
          current.map((job) => (job.id === result.job!.id ? result.job! : job)),
        );
        appendAssistantMessage(result.message, result, result.job);
      } else {
        appendAssistantMessage(result.message, result);
      }
    } catch (error) {
      appendAssistantMessage(
        error instanceof Error
          ? error.message
          : 'I could not process that update. Please try again.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCandidateSelection = async (
    messageId: string,
    candidate: Job,
    proposedChanges?: QuickUpdateProposedChanges,
  ) => {
    if (!proposedChanges || isProcessing || handledMessages.has(messageId)) return;
    setHandledMessages((current) => new Set(current).add(messageId));
    setIsProcessing(true);
    try {
      const result = await quickUpdateJob({
        confirmedJobId: candidate.id,
        proposedChanges,
      });
      if (result.job) {
        notifyJobChanged('updated', result.job);
        setTrackedJobs((current) =>
          current.map((job) => (job.id === result.job!.id ? result.job! : job)),
        );
        appendAssistantMessage(result.message, result, result.job);
      }
    } catch (error) {
      setHandledMessages((current) => {
        const next = new Set(current);
        next.delete(messageId);
        return next;
      });
      appendAssistantMessage(
        error instanceof Error ? error.message : 'I could not update that application.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateJob = async (
    messageId: string,
    proposedChanges?: QuickUpdateProposedChanges,
  ) => {
    if (!proposedChanges?.company || isProcessing || handledMessages.has(messageId)) return;
    setHandledMessages((current) => new Set(current).add(messageId));
    setIsProcessing(true);
    try {
      const response = await createJob({
        company: proposedChanges.company,
        title: proposedChanges.title ?? 'Prospective Role',
        status: proposedChanges.status ?? 'applied',
        location: proposedChanges.location,
        notes: proposedChanges.notes,
      });
      const createdJob = response.job;
      notifyJobChanged('created', createdJob);
      setTrackedJobs((current) => [createdJob, ...current]);
      appendAssistantMessage(
        `Added ${createdJob.company} — ${createdJob.title} to your tracker as ${createdJob.status}.`,
        undefined,
        createdJob,
      );
    } catch (error) {
      setHandledMessages((current) => {
        const next = new Set(current);
        next.delete(messageId);
        return next;
      });
      appendAssistantMessage(
        error instanceof Error ? error.message : 'I could not create that application.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div ref={widgetContainerRef}>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen((current) => !current)}
        className={[
          'fixed bottom-5 right-5 z-50 h-11 px-4 rounded-full',
          'liquid-glass-lens text-ink',
          'flex items-center gap-2.5 transition-all duration-300 active:scale-95 cursor-pointer',
        ].join(' ')}
        aria-label="Toggle AI Assistant"
      >
        <Bot size={17} className="text-signal" />
        <span className="font-mono text-xs uppercase tracking-wider font-semibold text-ink">
          {isOpen ? 'Close' : 'AI Assistant'}
        </span>
      </button>

      {/* Opened Liquid Glass Popup */}
      {isOpen && (
        <div className="fixed bottom-18 right-5 z-50 w-96 max-w-[calc(100vw-2.5rem)] h-[440px] max-h-[calc(100vh-6rem)] liquid-glass-container text-ink rounded-2xl flex flex-col overflow-hidden animate-fade-in-scale">
          {/* Liquid Glass Header */}
          <div className="px-3.5 py-2.5 border-b border-white/70 bg-white/40 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-signal/15 border border-signal/30 flex items-center justify-center shadow-xs">
                <Bot size={15} className="text-signal" />
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-ink leading-tight">
                  AI Assistant
                </h3>
                <p className="text-[10px] font-mono text-ink-muted leading-tight mt-0.5">
                  Update job applications quickly
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-ink-muted hover:text-ink hover:bg-black/5 rounded-md transition-colors cursor-pointer"
              aria-label="Close assistant"
            >
              <X size={15} />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 font-mono text-xs">
            {messages.map((message) => {
              const handled = handledMessages.has(message.id);
              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'assistant' && (
                    <div className="w-5 h-5 rounded-full bg-signal/20 border border-signal/35 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Bot size={11} className="text-signal" />
                    </div>
                  )}

                  <div
                    className={`max-w-[86%] min-w-0 p-2.5 rounded-xl ${
                      message.sender === 'user'
                        ? 'bg-ink text-bg font-sans font-medium shadow-md'
                        : 'liquid-glass-card text-ink'
                    }`}
                  >
                    <p className="leading-relaxed wrap-break-word">{message.text}</p>

                    {message.actionJob && (
                      <div className="mt-2 pt-2 border-t border-black/8 flex items-center gap-1.5 text-[10px] text-emerald-700 min-w-0 font-medium">
                        <CheckCircle2 size={11} className="shrink-0" />
                        <span className="truncate text-ink font-semibold">
                          {message.actionJob.company} · {message.actionJob.title}
                        </span>
                        <Badge
                          variant={message.actionJob.status}
                          label={message.actionJob.status}
                          dot
                        />
                      </div>
                    )}

                    {message.result?.action === 'disambiguate' &&
                      message.result.candidates && (
                        <div className="mt-2 space-y-1.5">
                          {message.result.candidates.map((candidate) => (
                            <button
                              key={candidate.id}
                              type="button"
                              disabled={handled || isProcessing}
                              onClick={() =>
                                handleCandidateSelection(
                                  message.id,
                                  candidate,
                                  message.result?.proposedChanges,
                                )
                              }
                              className="w-full min-w-0 p-2 text-left bg-white/65 hover:bg-white/95 rounded-lg border border-white/80 hover:border-signal/80 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                            >
                              <span className="block truncate font-bold text-ink text-xs">
                                {candidate.title}
                              </span>
                              <span className="block truncate text-[10px] text-ink-muted">
                                {candidate.company} · {candidate.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                    {(message.result?.action === 'not_found' ||
                      message.result?.action === 'created') &&
                      message.result.proposedChanges?.company && (
                        <button
                          type="button"
                          disabled={handled || isProcessing}
                          onClick={() =>
                            handleCreateJob(
                              message.id,
                              message.result?.proposedChanges,
                            )
                          }
                          className="mt-2 w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border border-signal/60 text-signal bg-signal/10 hover:bg-signal/20 disabled:opacity-50 font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Briefcase size={11} />
                          Track as new application
                        </button>
                      )}
                  </div>
                </div>
              );
            })}

            {isProcessing && (
              <div className="flex items-center gap-2 text-ink-muted italic font-medium">
                <Bot size={11} className="animate-pulse text-signal" />
                Thinking…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {suggestedPrompts.length > 0 && (
            <div className="px-3 py-2 border-t border-white/60 bg-white/25 backdrop-blur-md flex overflow-x-auto gap-1.5 no-scrollbar">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  disabled={isProcessing}
                  onClick={() => {
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 text-[9px] font-mono px-2.5 py-1 bg-white/70 hover:bg-white text-ink-muted hover:text-ink border border-white/90 rounded-md disabled:opacity-50 max-w-55 truncate shadow-xs transition-all cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
            className="p-3 border-t border-white/60 bg-white/40 backdrop-blur-md flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={isProcessing}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tell me what changed…"
              className="flex-1 min-w-0 bg-white/80 text-ink text-xs px-3 py-2 border border-white/90 rounded-lg placeholder:text-ink-muted/60 focus:outline-none focus:border-ink/40 focus:ring-1 focus:ring-ink/10 disabled:opacity-60 shadow-xs transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              aria-label="Send message"
              className="h-8 w-8 bg-ink text-bg rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-ink/90 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Send size={13} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
