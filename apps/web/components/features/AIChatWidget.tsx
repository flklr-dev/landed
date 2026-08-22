'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Briefcase, CheckCircle2, Send, Sparkles, X } from 'lucide-react';
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
    text: 'Tell me about an application update. I can change statuses, add notes, or help track a new role.',
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
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isProcessing, setIsProcessing] = useState(false);
  const [handledMessages, setHandledMessages] = useState<Set<string>>(new Set());
  const [trackedJobs, setTrackedJobs] = useState<Job[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestedPrompts = buildSuggestedPrompts(trackedJobs);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    inputRef.current?.focus();
  }, [messages, isOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

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
    if (
      !proposedChanges?.company ||
      isProcessing ||
      handledMessages.has(messageId)
    ) return;

    setHandledMessages((current) => new Set(current).add(messageId));
    setIsProcessing(true);
    try {
      const response = await createJob({
        company: proposedChanges.company,
        title: proposedChanges.title || 'Job Position',
        status: proposedChanges.status || 'saved',
        notes: proposedChanges.notes,
        location: proposedChanges.location,
        salaryRaw: proposedChanges.salaryRaw,
        requiredSkills: [],
      });
      notifyJobChanged('created', response.job);
      setTrackedJobs((current) => [response.job, ...current]);
      appendAssistantMessage(
        `Added ${response.job.title} at ${response.job.company} to your tracker.`,
        undefined,
        response.job,
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
    <>
      <button
        onClick={() => setIsOpen((current) => !current)}
        className={[
          'fixed bottom-5 right-5 z-50 h-12 px-4 rounded-full shadow-lg',
          'flex items-center gap-2.5 transition-all duration-200 active:scale-95',
          isOpen
            ? 'bg-panel text-panel-fg border border-panel-fg/20'
            : 'bg-panel text-panel-fg hover:bg-panel/90 border border-signal/40',
        ].join(' ')}
        aria-label="Toggle Landed Assistant"
      >
        <Sparkles size={18} className="text-signal" />
        <span className="font-mono text-xs uppercase tracking-wider font-medium">
          {isOpen ? 'Close' : 'Assistant'}
        </span>
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-96 max-w-[calc(100vw-2.5rem)] h-130 max-h-[calc(100vh-7rem)] bg-panel text-panel-fg border border-panel-fg/15 shadow-2xl flex flex-col animate-fade-in-scale">
          <div className="p-3.5 border-b border-panel-fg/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-sm bg-signal/20 flex items-center justify-center">
                <Sparkles size={13} className="text-signal" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider">
                  Landed Assistant
                </h3>
                <p className="text-[10px] font-mono text-panel-fg/50">
                  Application updates · Ctrl/⌘ K
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-panel-fg/50 hover:text-panel-fg transition-colors"
              aria-label="Close assistant"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 font-mono text-xs">
            {messages.map((message) => {
              const handled = handledMessages.has(message.id);
              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'assistant' && (
                    <div className="w-5 h-5 rounded-full bg-signal/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={11} className="text-signal" />
                    </div>
                  )}

                  <div
                    className={`max-w-[86%] min-w-0 p-2.5 rounded-sm ${
                      message.sender === 'user'
                        ? 'bg-signal text-panel font-sans font-medium'
                        : 'bg-panel-fg/8 text-panel-fg/90 border border-panel-fg/10'
                    }`}
                  >
                    <p className="leading-relaxed wrap-break-word">{message.text}</p>
                    {message.result?.parsedBy && (
                      <p className="mt-1.5 text-[9px] uppercase tracking-wider text-panel-fg/35">
                        parsed by {message.result.parsedBy}
                      </p>
                    )}

                    {message.actionJob && (
                      <div className="mt-2 pt-2 border-t border-panel-fg/10 flex items-center gap-1.5 text-[10px] text-green-400 min-w-0">
                        <CheckCircle2 size={11} className="shrink-0" />
                        <span className="truncate">
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
                              className="w-full min-w-0 p-2 text-left border border-panel-fg/15 hover:border-signal/60 hover:bg-panel-fg/5 disabled:opacity-50 transition-colors"
                            >
                              <span className="block truncate font-semibold">
                                {candidate.title}
                              </span>
                              <span className="block truncate text-[10px] text-panel-fg/50">
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
                          className="mt-2 w-full flex items-center justify-center gap-1.5 p-2 border border-signal/40 text-signal hover:bg-signal/10 disabled:opacity-50 transition-colors"
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
              <div className="flex items-center gap-2 text-panel-fg/40 italic">
                <Bot size={11} className="animate-pulse text-signal" />
                Understanding your update…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {suggestedPrompts.length > 0 && (
            <div className="px-3 py-2 border-t border-panel-fg/10 bg-panel-fg/3 flex overflow-x-auto gap-1.5">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  disabled={isProcessing}
                  onClick={() => {
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                  className="shrink-0 text-[9px] font-mono px-2 py-1 bg-panel-fg/8 hover:bg-panel-fg/15 text-panel-fg/70 border border-panel-fg/10 rounded-sm disabled:opacity-50 max-w-55 truncate"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
            className="p-3 border-t border-panel-fg/10 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              disabled={isProcessing}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Tell me what changed…"
              className="flex-1 min-w-0 bg-panel-fg/5 text-panel-fg text-xs px-3 py-2 border border-panel-fg/15 rounded-sm placeholder:text-panel-fg/40 focus:outline-none focus:border-signal disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              aria-label="Send message"
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
