interface FooterProps {
  onHome: () => void;
}

export function Footer({ onHome }: FooterProps) {
  return (
    <footer className="mt-16 border-t-2 border-gray-900 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button onClick={onHome} className="text-left">
            <span className="text-xl font-serif font-bold text-gray-900">USA Daily News</span>
            <p className="text-xs text-gray-500 mt-1">Independent American journalism.</p>
          </button>
        </div>
        <p className="mt-8 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} USA Daily News. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
