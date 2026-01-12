import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { BadgeDefinition } from '../lib/badges';

type BadgeUnlockNotificationProps = {
  badge: BadgeDefinition;
  onClose: () => void;
};

export function BadgeUnlockNotification({ badge, onClose }: BadgeUnlockNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
      <div
        className={`pointer-events-auto bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl border-2 border-amber-400 p-6 max-w-md w-full shadow-2xl transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
        }`}
      >
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="text-6xl mb-4 animate-bounce">
            {badge.icon}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-200" />
            <h2 className="text-xl font-bold text-white uppercase tracking-wide">
              Badge Unlocked
            </h2>
            <Sparkles className="w-5 h-5 text-amber-200" />
          </div>

          <div className="text-3xl font-bold text-white mb-2">
            {badge.name}
          </div>

          <p className="text-amber-100 text-sm mb-4">
            {badge.description}
          </p>

          {badge.xpReward > 0 && (
            <div className="px-4 py-2 bg-white/20 rounded-xl">
              <span className="text-white font-bold">+{badge.xpReward} XP</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
