'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { AvatarDisplay } from '@/components/avatar/AvatarComponents';
import { useAppStore } from '@/lib/store';
import { useWallet } from '@/hooks/useWallet';
import { Home, MapPin, Plus, Wallet, User, QrCode, Scan } from 'lucide-react';

export function BottomNav() {
  const { activeBottomSheet, setActiveBottomSheet } = useAppStore();
  const { isConnected, address, connect, disconnect } = useWallet();
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const navItems = [
    { id: 'map', icon: Home, label: 'City', badge: null },
    { id: 'drops', icon: MapPin, label: 'Drops', badge: '3' },
    { id: 'create', icon: Plus, label: '', badge: null, isCenter: true },
    { id: 'wallet', icon: Wallet, label: 'Wallet', badge: isConnected ? null : '!' },
    { id: 'profile', icon: User, label: 'Profile', badge: null },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="glass-strong border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
                item.isCenter
                  ? 'relative z-10'
                  : activeBottomSheet === item.id || (item.id === 'map' && activeBottomSheet === 'none')
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              )}
              style={item.isCenter ? { transform: 'translateY(-4px)' } : undefined}
            >
              {!item.isCenter && <item.icon className="h-6 w-6" />}
              {item.isCenter && (
                <Button
                  size="icon"
                  variant={showCreateMenu ? 'default' : 'gradient'}
                  className="h-12 w-12 rounded-2xl shadow-xl"
                  onClick={(e) => { e.stopPropagation(); setShowCreateMenu(!showCreateMenu); }}
                >
                  <Plus className="h-6 w-6" />
                </Button>
              )}
              {!item.isCenter && item.label && <span className="text-xs font-medium">{item.label}</span>}
              {item.badge && !item.isCenter && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}

          {showCreateMenu && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-2">
              <div className="glass-strong rounded-2xl p-3 shadow-xl flex gap-2">
                <CreateMenuItem icon={QrCode} label="QR Drop" onClick={() => { setShowCreateMenu(false); setActiveBottomSheet('create-drop'); }} />
                <CreateMenuItem icon={MapPin} label="Location Drop" onClick={() => { setShowCreateMenu(false); setActiveBottomSheet('create-drop'); }} />
                <CreateMenuItem icon={Plus} label="Token" onClick={() => { setShowCreateMenu(false); setActiveBottomSheet('create-token'); }} />
                <CreateMenuItem icon={Scan} label="Event" onClick={() => { setShowCreateMenu(false); setActiveBottomSheet('create-drop' as any); }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateMenuItem({ icon: Icon, label, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-[80px]"
    >
      <Icon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
    </button>
  );
}

function handleNavClick(id: string) {
  const store = useAppStore.getState();
  switch (id) {
    case 'map':
      store.setActiveBottomSheet('none');
      store.setSelectedMarkerId(null);
      break;
    case 'drops':
      store.setActiveBottomSheet('drop' as any);
      break;
    case 'wallet':
      store.setActiveBottomSheet('wallet');
      break;
    case 'profile':
      store.setActiveBottomSheet('profile');
      break;
  }
}