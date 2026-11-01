import { CATEGORIES, type Category } from '@/lib/categories';

interface CategoryFilterProps {
  active: Category;
  onSelect: (c: Category) => void;
  onNavigate: (path: string) => void;
}

export function CategoryFilter({ active, onSelect, onNavigate }: CategoryFilterProps) {
  return (
    <nav aria-label="News topics" className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4">
        <ul className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
          {CATEGORIES.map((c) => {
            const isActive = c === active;
            return (
              <li key={c}>
                <button
                  onClick={() => onSelect(c)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-pressed={isActive}
                >
                  {c}
                </button>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => onNavigate('/football')}
              className="px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Sports
            </button>
          </li>
          <li>
            <button
              onClick={() => onNavigate('/weather')}
              className="px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Weather
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
