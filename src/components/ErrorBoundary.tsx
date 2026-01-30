import { Component, ReactNode } from 'react';
import { Anchor, AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="container mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-12">
              <Anchor className="w-8 h-8 text-amber-500" />
              <h1 className="text-2xl font-bold tracking-wide">MY YACHT TIME</h1>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="bg-red-500/10 border border-red-500 rounded-2xl p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <AlertCircle className="w-12 h-12 text-red-500 flex-shrink-0" />
                  <div>
                    <h2 className="text-2xl font-bold text-red-500 mb-2">Configuration Error</h2>
                    <p className="text-slate-300">The application is not properly configured.</p>
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-4 mb-6">
                  <p className="text-sm font-mono text-red-400 break-all">
                    {this.state.error?.message || 'Unknown error occurred'}
                  </p>
                </div>

                <div className="space-y-4 text-sm text-slate-300">
                  <p className="font-semibold text-white">If you are the administrator:</p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>Go to your Vercel dashboard</li>
                    <li>Select this project</li>
                    <li>Navigate to Settings → Environment Variables</li>
                    <li>Add the required VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables</li>
                    <li>Redeploy the application</li>
                  </ol>

                  <div className="mt-6 pt-6 border-t border-slate-700">
                    <p className="text-slate-400">
                      If you are a user, please contact the system administrator at{' '}
                      <a href="mailto:sales@azmarine.net" className="text-amber-500 hover:text-amber-400">
                        sales@azmarine.net
                      </a>
                      {' '}or{' '}
                      <a href="tel:928-637-6500" className="text-amber-500 hover:text-amber-400">
                        928-637-6500
                      </a>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => window.location.reload()}
                  className="mt-8 w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 rounded-lg transition-all duration-300"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
