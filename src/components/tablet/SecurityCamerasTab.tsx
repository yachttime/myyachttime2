import { Video } from 'lucide-react';

export function SecurityCamerasTab() {
  return (
    <div className="h-full min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
          <Video className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold">Security Cameras</h2>
        <p className="text-slate-400">
          Camera feeds are not connected to this tablet yet. Once the camera system is set up, the live views will appear here.
        </p>
      </div>
    </div>
  );
}
