import { Twitter, Facebook, Youtube, Linkedin } from 'lucide-react';
import { SITE_CONFIG } from '@/lib/seo-config';

interface FooterProps {
  onHome: () => void;
}

export function Footer({ onHome }: FooterProps) {
  return (
    <footer className="mt-16 border-t-2 border-gray-900 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
          <div>
            <button onClick={onHome} className="text-left" aria-label="USA Daily News home">
              <span className="text-xl font-serif font-bold text-gray-900">USA Daily News</span>
              <p className="text-xs text-gray-500 mt-1">Independent American journalism.</p>
            </button>
            <p className="mt-4 text-sm text-gray-600 max-w-xs leading-relaxed">
              Covering Politics, Tech, Economy, and Culture with clarity and coverage you can trust.
            </p>
          </div>

          <nav aria-label="Social profiles">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3">
              Follow Us
            </h2>
            <ul className="flex items-center gap-4">
              <li>
                <a
                  href={SITE_CONFIG.sameAs[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="USA Daily News on Twitter"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_CONFIG.sameAs[1]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="USA Daily News on Facebook"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_CONFIG.sameAs[2]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="USA Daily News on YouTube"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Youtube className="h-5 w-5" />
                </a>
              </li>
              <li>
                <a
                  href={SITE_CONFIG.sameAs[3]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="USA Daily News on LinkedIn"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <p className="mt-8 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} USA Daily News. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
