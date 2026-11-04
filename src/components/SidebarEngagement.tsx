import { useEffect, useMemo, useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ArticleSummary } from '@/types/article';

type Poll = { question: string; options: string[] };
const POLLS: Poll[] = [
  { question: 'Which issue should receive the most attention from US leaders?', options: ['The cost of living', 'Healthcare', 'Jobs and the economy', 'Immigration'] },
  { question: 'What is your biggest source of news?', options: ['News websites', 'Television', 'Social media', 'Podcasts'] },
  { question: 'Which topic would you like us to cover more?', options: ['US politics', 'Technology and AI', 'Business and economy', 'Culture and sports'] },
  { question: 'How often do you follow the news?', options: ['Several times a day', 'Once a day', 'A few times a week', 'Occasionally'] },
  { question: 'What matters most when reading a news story?', options: ['Speed of reporting', 'Accuracy and sources', 'Clear explanations', 'Different viewpoints'] },
  { question: 'Which area of technology interests you most?', options: ['Artificial intelligence', 'Cybersecurity', 'Consumer gadgets', 'Space and science'] },
  { question: 'How do you prefer to follow breaking news?', options: ['Live updates', 'Short summaries', 'In-depth articles', 'Audio and podcasts'] },
];

function getVisitorId() {
  const key = 'usadailynews-engagement-voter';
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = window.crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}

export function SidebarEngagement({ onOpenArticle }: { onOpenArticle: (id: number) => void }) {
  const day = new Date().toISOString().slice(0, 10);
  const dayNumber = Math.floor(Date.parse(day + 'T00:00:00Z') / 86400000);
  const poll = POLLS[dayNumber % POLLS.length];
  const pollKey = 'daily-poll-' + (dayNumber % POLLS.length);
  const [votes, setVotes] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trending, setTrending] = useState<(ArticleSummary & { view_count: number })[]>([]);
  const [dailyQuestions, setDailyQuestions] = useState<ArticleSummary[]>([]);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    const voter = getVisitorId();
    const storedVote = window.localStorage.getItem('usadailynews-vote-' + day + '-' + pollKey);
    if (storedVote !== null) {
      setVoted(true);
      setSelected(Number(storedVote));
    }
    Promise.all([
      supabase.from('daily_poll_votes').select('option_index').eq('poll_date', day).eq('poll_key', pollKey),
      supabase.from('article_trending').select('id, title, category, image_url, seo_description, created_at, source_url, view_count').limit(5),
      supabase.from('articles').select('id, title, category, image_url, seo_description, created_at, source_url').order('created_at', { ascending: false }).limit(14),
    ]).then(([pollResult, trendingResult, latestResult]) => {
      if (!active) return;
      const counts = Array(poll.options.length).fill(0) as number[];
      (pollResult.data ?? []).forEach((vote) => {
        if (vote.option_index >= 0 && vote.option_index < counts.length) counts[vote.option_index] += 1;
      });
      setVotes(counts);
      setTrending((trendingResult.data ?? []) as (ArticleSummary & { view_count: number })[]);
      const latest = (latestResult.data ?? []) as ArticleSummary[];
      if (latest.length) {
        const start = dayNumber % latest.length;
        setDailyQuestions(Array.from({ length: Math.min(3, latest.length) }, (_, index) => latest[(start + index) % latest.length]));
      }
      void voter;
    });
    return () => { active = false; };
  }, [day, pollKey, poll.options.length]);

  const totalVotes = useMemo(() => votes.reduce((sum, count) => sum + count, 0), [votes]);

  const castVote = async () => {
    if (selected === null || voted || !supabase) return;
    setSubmitting(true);
    const { error } = await supabase.from('daily_poll_votes').insert({
      poll_date: day, poll_key: pollKey, option_index: selected, voter_id: getVisitorId(),
    });
    if (!error) {
      window.localStorage.setItem('usadailynews-vote-' + day + '-' + pollKey, String(selected));
      setVoted(true);
      setVotes((current) => current.map((count, index) => index === selected ? count + 1 : count));
    } else if (error.code === '23505') {
      setVoted(true);
      window.localStorage.setItem('usadailynews-vote-' + day + '-' + pollKey, String(selected));
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-sm border border-gray-200 bg-white p-4" aria-labelledby="reader-poll-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="reader-poll-heading" className="font-serif font-bold text-gray-900">Today's Reader Poll</h2>
          <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">Daily</span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-800">{poll.question}</p>
        <div className="mt-3 space-y-2">
          {poll.options.map((option, index) => {
            const percentage = totalVotes ? Math.round(((votes[index] ?? 0) / totalVotes) * 100) : 0;
            return (
              <button key={option} type="button" disabled={voted || submitting} onClick={() => setSelected(index)}
                className={`relative block w-full overflow-hidden rounded-sm border px-3 py-2 text-left text-sm transition-colors ${selected === index ? 'border-red-700 bg-red-50' : 'border-gray-200 hover:border-gray-400'} ${voted ? 'cursor-default' : ''}`}>
                {voted && <span className="absolute inset-y-0 left-0 bg-gray-100" style={{ width: percentage + '%' }} />}
                <span className="relative flex items-center justify-between gap-2">
                  <span>{option}</span>
                  {voted && <strong className="text-xs tabular-nums">{percentage}%</strong>}
                </span>
              </button>
            );
          })}
        </div>
        {!voted ? (
          <button type="button" onClick={castVote} disabled={selected === null || submitting}
            className="mt-3 w-full rounded-sm bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40">
            {submitting ? 'Submitting…' : 'Cast your vote'}
          </button>
        ) : (
          <p className="mt-3 text-xs text-gray-500">Thanks for taking part · {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} today</p>
        )}
        <p className="mt-2 text-[11px] text-gray-400">A new question is published automatically every day.</p>
      </section>

      <section className="rounded-sm border border-gray-200 bg-white p-4" aria-labelledby="trending-heading">
        <h2 id="trending-heading" className="flex items-center gap-2 font-serif font-bold text-gray-900">
          <TrendingUp className="h-4 w-4 text-red-700" /> Trending Now
        </h2>
        <p className="mt-1 text-xs text-gray-500">Most-read stories over the last 7 days</p>
        {trending.length > 0 ? (
          <ol className="mt-3 space-y-3">
            {trending.map((story, index) => (
              <li key={story.id} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <span className="pt-0.5 text-lg font-bold text-gray-300">{index + 1}</span>
                <button type="button" onClick={() => onOpenArticle(story.id)} className="min-w-0 text-left">
                  <span className="block text-sm font-semibold leading-snug text-gray-800 hover:text-red-700">{story.title}</span>
                  <span className="mt-1 block text-[11px] text-gray-500">{story.view_count.toLocaleString()} reads · {story.category}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Reader favourites will appear here as visitors explore stories.</p>
        )}
      </section>

      <section className="rounded-sm border border-gray-200 bg-white p-4" aria-labelledby="news-questions-heading">
        <div className="flex items-center justify-between gap-2">
          <h2 id="news-questions-heading" className="font-serif font-bold text-gray-900">Questions People Are Asking</h2>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">Daily</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">Quick answers based on the latest stories</p>
        {dailyQuestions.length > 0 ? (
          <div className="mt-3 divide-y divide-gray-100">
            {dailyQuestions.map((story) => (
              <article key={story.id} className="py-3 first:pt-0 last:pb-0">
                <h3 className="text-sm font-semibold leading-snug text-gray-900">What should readers know about {story.title.replace(/[?.!]+$/, '')}?</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{story.seo_description || `This latest ${story.category || 'news'} report covers ${story.title.replace(/[?.!]+$/, '')}. Open the full story for the details and developments.`}</p>
                <button type="button" onClick={() => onOpenArticle(story.id)} className="mt-2 text-xs font-semibold text-red-700 hover:text-red-900">Read the full story →</button>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">New questions and answers will appear as fresh stories are published.</p>
        )}
      </section>
    </div>
  );
}
