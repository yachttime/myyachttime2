import { useEffect } from 'react';

const PRESENTATION_URL = 'https://claude.ai/artifact/JqsetnSNyrBxDZ6gAZng1Q';

export const WatchPresentation = () => {
  useEffect(() => {
    window.location.replace(PRESENTATION_URL);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
      <div className="text-center px-6">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500 mx-auto mb-6" />
        <p className="text-lg text-slate-300">
          Taking you to the MyYachtTime presentation...
        </p>
        <p className="mt-4">
          <a
            href={PRESENTATION_URL}
            className="text-amber-500 hover:text-amber-400 transition-colors underline underline-offset-4"
          >
            Click here if you are not redirected automatically
          </a>
        </p>
      </div>
    </div>
  );
};
