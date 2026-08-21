import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function LiveClock() {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Phoenix',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setCurrentTime(formatter.format(now));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 w-fit">
      <Clock className="w-4 h-4 text-blue-500" />
      <div>
        <div className="text-xl font-bold text-white">{currentTime}</div>
        <div className="text-xs text-slate-400">MST</div>
      </div>
    </div>
  );
}
