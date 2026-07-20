import { ReactNode } from 'react';

interface AdminViewWrapperProps {
  onBack: () => void;
  backHoverColor?: string;
  children: ReactNode;
}

export default function AdminViewWrapper({ onBack, backHoverColor = 'hover:text-amber-500', children }: AdminViewWrapperProps) {
  return (
    <>
      <button
        onClick={onBack}
        className={`flex items-center gap-2 text-slate-400 ${backHoverColor} transition-colors mb-4`}
      >
        <span>← Back to Admin Menu</span>
      </button>
      {children}
    </>
  );
}
