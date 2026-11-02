import { useSeo } from '@/lib/seo';
import type { ReactNode } from 'react';

const CONTACT_EMAIL = 'info.luwigang254@gmail.com';

function PageShell({ eyebrow, title, description, url, children }: {
  eyebrow: string; title: string; description: string; url: string; children: ReactNode;
}) {
  useSeo({ title, description, url });
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-red-700">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-serif font-bold text-gray-900">{title}</h1>
      <div className="mt-6 space-y-7 text-base leading-relaxed text-gray-700">{children}</div>
    </article>
  );
}

export function AboutPage() {
  return (
    <PageShell eyebrow="Who we are" title="About USA Daily News"
      description="Learn about USA Daily News, our coverage, how we use sources and automated tools, and how to contact us."
      url="https://usadailynews.space/about">
      <p>USA Daily News is a digital publication covering news and developing stories across the United States and around the world, including politics, business, technology, culture, weather and sports.</p>
      <section><h2 className="text-xl font-semibold text-gray-900">How we publish</h2>
        <p>Our website uses digital tools and AI-assisted processes to help discover, organize and prepare news summaries. Articles may summarize reporting published by other outlets. Where source information is available, we identify and link to the original report so readers can consult it directly.</p>
        <p>We do not claim that every item is original, independent reporting produced by an on-the-ground newsroom. Readers should consult linked primary sources for additional context, and contact us if they identify an error or missing attribution.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">Our aim</h2>
        <p>We aim to make current events easier to follow through clear headlines, accessible summaries and links to source material. We work to correct material inaccuracies when they are brought to our attention and verified.</p>
      </section>
      <p>Questions, feedback or news tips? Email <a className="font-semibold text-red-700 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </PageShell>
  );
}

export function EditorialPolicyPage() {
  return (
    <PageShell eyebrow="Our standards" title="Editorial Policy"
      description="Read the USA Daily News editorial standards for sourcing, AI-assisted content, accuracy, attribution and updates."
      url="https://usadailynews.space/editorial-policy">
      <p>USA Daily News aims to publish clear, useful news summaries and to make the source of reported information as transparent as possible.</p>
      <section><h2 className="text-xl font-semibold text-gray-900">Sources and attribution</h2>
        <p>We use published reports, official statements, public information and other available source material to prepare coverage. When an article is based on a report from another publisher, we aim to identify and link to that source. Readers should follow the source link for the full original reporting and context.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">AI-assisted publishing</h2>
        <p>Automated systems and AI-assisted tools may be used to identify, organize, summarize and prepare content. These tools can make mistakes. The presence of an article on this website should not be taken as a guarantee that every detail has been independently verified by a human editor.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">Accuracy and updates</h2>
        <p>We seek to represent source material fairly, avoid presenting unconfirmed claims as established facts, and update or correct content when reliable information shows that a material detail is wrong. Developing stories may change as new information becomes available.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">Independence and limitations</h2>
        <p>Coverage may include summaries of third-party reporting and does not necessarily represent original reporting by USA Daily News. We do not promise that every story will be exhaustive or free from error. This policy describes our intended publishing approach and may be updated as our processes evolve.</p>
      </section>
      <p>To raise a concern about a story, email <a className="font-semibold text-red-700 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and include the article link and supporting information.</p>
    </PageShell>
  );
}

export function CorrectionsPolicyPage() {
  return (
    <PageShell eyebrow="Accuracy matters" title="Corrections Policy"
      description="How to report an error and how USA Daily News reviews and corrects inaccurate or incomplete information."
      url="https://usadailynews.space/corrections">
      <p>We want readers to be able to rely on the information and source links presented on USA Daily News. If you believe an article contains a factual error, misleading wording or incorrect attribution, please tell us.</p>
      <section><h2 className="text-xl font-semibold text-gray-900">How to request a correction</h2>
        <p>Email <a className="font-semibold text-red-700 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Include the article URL, the exact statement you believe is incorrect, what you believe the correct information should be, and links to reliable supporting sources or documents.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">How we review reports</h2>
        <p>We assess the information provided and compare it with the available source material. If a material error is confirmed, we may correct the article, clarify the wording, update its source attribution or remove content when appropriate. A correction request is not automatically accepted; claims are assessed against the evidence available.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">Updates to developing stories</h2>
        <p>When a developing story changes, an article may be updated to reflect newer information. We aim not to leave outdated or disproven claims presented as current facts.</p>
      </section>
      <p>Please use the subject line “Correction request” to help us identify your message.</p>
    </PageShell>
  );
}

export function PrivacyPolicyPage() {
  return (
    <PageShell eyebrow="Your information" title="Privacy Policy"
      description="How USA Daily News handles information when you visit the website, use analytics or contact us."
      url="https://usadailynews.space/privacy-policy">
      <p>This policy explains, in general terms, how information may be handled when you visit usadailynews.space or contact USA Daily News. It was last updated on November 2, 2026.</p>
      <section><h2 className="text-xl font-semibold text-gray-900">Information collected through the website</h2>
        <p>Our website uses Google Analytics (measurement ID G-66N8NWPZTJ) to understand visits and page usage. Analytics technologies may collect information such as pages viewed, approximate location derived from network information, device and browser details, and interaction data. Google processes analytics information under its own terms and privacy policies.</p>
        <p>Our website is delivered using Cloudflare and stores article content using Supabase. These service providers may process technical information needed to deliver, secure and operate the website, such as request and diagnostic data.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">Messages you send us</h2>
        <p>If you email us, we receive the information you choose to include, such as your email address, message and any files or links you provide. We use it to respond, review news tips or assess correction requests. Please do not send sensitive personal information unless it is necessary for your enquiry.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">Cookies and analytics controls</h2>
        <p>Analytics services may use cookies or similar technologies. You can manage cookies through your browser settings and review Google's available privacy and advertising controls. Blocking cookies or scripts may affect some website functions or measurement.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">External links</h2>
        <p>Articles may link to other websites and publishers. Those sites operate under their own privacy policies and practices. We are not responsible for the privacy practices of external websites.</p>
      </section>
      <section><h2 className="text-xl font-semibold text-gray-900">Changes and contact</h2>
        <p>We may update this policy as the website and its services change. For privacy questions, contact <a className="font-semibold text-red-700 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </section>
      <p>This page is a general description of the website's current tools, not legal advice. It should be reviewed if the site's data practices or services change.</p>
    </PageShell>
  );
}
