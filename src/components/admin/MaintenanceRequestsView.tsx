import { Wrench, RefreshCw, Anchor, User, Image } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MaintenanceRequest {
  id: string;
  subject: string;
  description: string;
  status: string;
  photo_url: string | null;
  created_at: string;
  yachts?: { name: string } | null;
  user_profiles?: { first_name: string | null; last_name: string | null } | null;
}

interface MaintenanceRequestsViewProps {
  requests: MaintenanceRequest[];
  onRefresh: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Phoenix',
  });
};

export default function MaintenanceRequestsView({ requests, onRefresh, onUpdateStatus }: MaintenanceRequestsViewProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="w-8 h-8 text-amber-500" />
          <div>
            <h2 className="text-2xl font-bold">Owner Maintenance Requests</h2>
            <p className="text-slate-400">Maintenance requests submitted by yacht owners and managers</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
          <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No maintenance requests found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className="text-lg font-semibold">{req.subject}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      req.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      req.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-amber-500/20 text-amber-400'
                    }`}>{req.status}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400 flex-wrap">
                    {req.yachts?.name && (
                      <span className="flex items-center gap-1">
                        <Anchor className="w-3.5 h-3.5" />
                        {req.yachts.name}
                      </span>
                    )}
                    {req.user_profiles && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {req.user_profiles.first_name} {req.user_profiles.last_name}
                      </span>
                    )}
                    <span>{formatDate(req.created_at)}</span>
                  </div>
                </div>
              </div>
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{req.description}</p>
              {req.photo_url && (
                <div className="mt-3">
                  <a href={req.photo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors">
                    <Image className="w-4 h-4" />
                    View Photo
                  </a>
                </div>
              )}
              <div className="mt-4">
                <select
                  value={req.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    const { error } = await supabase
                      .from('maintenance_requests')
                      .update({ status: newStatus })
                      .eq('id', req.id);
                    if (!error) {
                      onUpdateStatus(req.id, newStatus);
                    }
                  }}
                  className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
