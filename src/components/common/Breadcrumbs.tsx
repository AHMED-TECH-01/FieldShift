import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  onNavigate,
  className = '',
}) => {
  return (
    <nav
      aria-label="Breadcrumb navigation"
      className={`flex items-center flex-wrap gap-1 text-xs text-[#527367] ${className}`}
    >
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-1 hover:text-[#073D2B] transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] rounded-sm px-1.5 py-1.5 min-h-[36px]"
      >
        <Home className="w-3.5 h-3.5 text-[#76B93F] shrink-0" />
        <span>Home</span>
      </button>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={idx}>
            <ChevronRight className="w-3.5 h-3.5 text-[#8C9E94] flex-shrink-0" />
            {isLast || !item.path ? (
              <span
                className="font-semibold text-[#073D2B] px-1.5 py-1.5 max-w-[200px] sm:max-w-none truncate"
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(item.path!)}
                className="hover:text-[#073D2B] hover:underline transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] rounded-sm px-1.5 py-1.5 min-h-[36px] text-left"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
