import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, X, Loader2, RotateCcw } from 'lucide-react';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const starters = [
  'Summarize the latest US headlines',
  'Explain a major news story',
  'What should I know about today’s news?',
];

export function NewsAiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, open]);

  const sendMessage = async (value = input) => {
    const question = value.trim();
    if (!question || loading || question.length > 1200) return;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    const articleMatch = window.location.pathname.match(/^\/article\/(\d+)\/?$/);
    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.slice(-8),
          articleId: articleMatch ? Number(articleMatch[1]) : undefined,
        }),
      });
      const data = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !data.answer) {
        throw new Error(data.error || 'The assistant is temporarily unavailable. Please try again.');
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.answer! }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach the assistant. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const reset = () => {
    setMessages([]);
    setInput('');
    setError('');
  };

  return (
    <>
      {open && (
        <section
          className="fixed bottom-24 right-4 z-[100] flex h-[min(640px,calc(100dvh-7rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:bottom-24 sm:right-6"
          aria-label="USA Daily News AI chat"
          aria-live="polite"
        >
          <header className="flex items-center justify-between bg-slate-950 px-4 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold leading-tight">USA Daily News AI</p>
                <p className="mt-1 text-xs text-slate-300">Your news companion</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={reset} title="New conversation" aria-label="New conversation" className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} title="Close chat" aria-label="Close chat" className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4">
            {messages.length === 0 && (
              <div className="pt-3">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-800">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">What would you like to know?</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  Ask about the news, explore a story or get a clear explanation of the headlines.
                </p>
                <div className="mt-5 space-y-2">
                  {starters.map((starter) => (
                    <button key={starter} type="button" onClick={() => void sendMessage(starter)} className="block w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm text-gray-700 transition hover:border-red-300 hover:bg-red-50">
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={message.role === 'user'
                  ? 'max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-red-800 px-3.5 py-3 text-sm leading-6 text-white'
                  : 'max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md border border-gray-200 bg-white px-3.5 py-3 text-sm leading-6 text-gray-800'}>
                  {message.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            )}
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{error}</p>}
            <div ref={endRef} />
          </div>

          <form onSubmit={submit} className="border-t border-gray-200 bg-white p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-gray-300 bg-white p-2 focus-within:border-red-700 focus-within:ring-2 focus-within:ring-red-100">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                maxLength={1200}
                rows={1}
                placeholder="Ask USA Daily News AI…"
                aria-label="Your message"
                className="max-h-24 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0"
              />
              <button type="submit" disabled={!input.trim() || loading} aria-label="Send message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-800 text-white transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] leading-4 text-gray-400">AI can make mistakes. Check important details against the original reporting.</p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close USA Daily News AI' : 'Open USA Daily News AI'}
        aria-expanded={open}
        className="fixed bottom-5 right-4 z-[100] flex items-center gap-2 rounded-full bg-red-800 px-4 py-3.5 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-red-900 focus:outline-none focus:ring-4 focus:ring-red-200 sm:bottom-6 sm:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span>{open ? 'Close' : 'Ask AI'}</span>
      </button>
    </>
  );
}
