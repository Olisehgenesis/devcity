'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { MapPin, Layers, Target, RefreshCw, Map, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MapControls() {
  const { currentPosition, mapViewport, user } = useAppStore();
  const [showLayers, setShowLayers] = useState(false);

  const handleLocateMe = () => {
    if (currentPosition) {
      // // flyTo not available
    }
  };

  const handleCenterCity = () => {
    // flyTo({ lat: -1.2921, lng: 36.8219 }, 15);
  };

  return (
    <div className="absolute right-4 top-4 z-30 flex flex-col gap-2">
      <div className="glass-strong rounded-xl p-1 shadow-lg flex flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-lg"
          onClick={handleLocateMe}
          aria-label="Locate me"
        >
          <Target className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-lg"
          onClick={handleCenterCity}
          aria-label="Center on city"
        >
          <MapPin className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-lg"
          onClick={() => setShowLayers(!showLayers)}
          aria-label="Map layers"
        >
          <Layers className="h-5 w-5" />
        </Button>
      </div>

      {showLayers && (
        <div className="glass-strong rounded-xl p-3 shadow-lg w-48 animate-in slide-in-from-right-2">
          <p className="text-xs font-medium text-gray-500 mb-2 px-2">Map Style</p>
          <div className="space-y-1">
            {[
              { id: 'streets', label: 'Streets', icon: Map },
              { id: 'dark', label: 'Dark', icon: Map },
              { id: 'satellite', label: 'Satellite', icon: Globe },
            ].map(style => (
              <button
                key={style.id}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors',
                  false
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
                onClick={() => { /* Change map style */ }}
              >
                <style.icon className="h-4 w-4" />
                {style.label}
              </button>
            ))}
          </div>
          <hr className="my-2 border-gray-200 dark:border-gray-700" />
          <div className="space-y-1">
            {[
              { id: 'drops', label: 'Token Drops', icon: MapPin },
              { id: 'events', label: 'Events', icon: MapPin },
              { id: 'places', label: 'Places', icon: MapPin },
              { id: 'people', label: 'People', icon: MapPin },
              { id: 'quests', label: 'Quests', icon: MapPin },
            ].map(layer => (
              <label key={layer.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" defaultChecked />
                <layer.icon className="h-4 w-4 text-gray-500" />
                {layer.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {user && (
        <div className="glass-strong rounded-xl px-3 py-2 shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
            {user.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.username}</p>
            <p className="text-xs text-gray-500 truncate max-w-[120px]">{user.walletAddress?.slice(0, 6)}...{user.walletAddress?.slice(-4)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';