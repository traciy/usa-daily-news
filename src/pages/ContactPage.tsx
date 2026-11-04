import { Mail } from 'lucide-react';
import { useSeo } from '@/lib/seo';

const CONTACT_EMAIL = 'contact@usadailynews.space';

export function ContactPage() {
  useSeo({
    title: 'Contact USA Daily News',
    description: 'Contact USA Daily News with news tips, corrections, feedback, and general enquiries.',
    url: 'https://usadailynews.space/contact',
  });

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-red-700">Get in touch</p>
      <h1 className="mt-2 text-4xl font-serif font-bold text-gray-900">Contact USA Daily News</h1>
      <p className="mt-5 text-lg leading-relaxed text-gray-700">
        Have a question, news tip, correction, or feedback about something published on this site? We welcome your message.
      </p>
      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-red-700" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-gray-900">Email our team</h2>
        </div>
        <p className="mt-3 text-gray-600">For general enquiries, news tips, corrections, and feedback, email:</p>
        <a className="mt-3 inline-block break-all text-lg font-semibold text-red-700 underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">Submitting a correction</h2>
        <p className="mt-2 leading-relaxed text-gray-700">
          Please include the article URL, the specific detail you believe is inaccurate, and a link or document that can help us review it. We will assess the information and make updates when warranted.
        </p>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">Sending a news tip</h2>
        <p className="mt-2 leading-relaxed text-gray-700">
          Tell us what happened, when and where it happened, and how the information can be independently checked. Please distinguish what you witnessed from what you heard from others.
        </p>
      </section>
    </article>
  );
}
