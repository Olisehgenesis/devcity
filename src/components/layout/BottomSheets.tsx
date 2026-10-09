'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { AvatarDisplay } from '@/components/avatar/AvatarComponents';
import { formatDistanceToNow, formatTimeAgo, formatTokenAmount } from '@/lib/utils';
import type { MapMarker, Drop, Token, Event, Place, Quest, User } from '@/types';
import { useAppStore } from '@/lib/store';
import { demoDrops, demoEvents, demoPlaces, demoQuests, demoTokens, demoPeople } from '@/lib/demo-data';

function getDrop(dropId: string): Drop | undefined {
  return demoDrops.find(d => d.id === dropId);
}

function getToken(tokenId: string): Token | undefined {
  return demoTokens.find(t => t.id === tokenId);
}

function getEvent(eventId: string): Event | undefined {
  return demoEvents.find(e => e.id === eventId);
}

function getPlace(placeId: string): Place | undefined {
  return demoPlaces.find(p => p.id === placeId);
}

function getQuest(questId: string): Quest | undefined {
  return demoQuests.find(q => q.id === questId);
}

function getPerson(userId: string): any {
  return demoPeople.find(p => p.id === userId);
}

export function BottomSheets() {
  const { activeBottomSheet, selectedMarkerId, setActiveBottomSheet, mapMarkers } = useAppStore();
  
  if (activeBottomSheet === 'none' || !selectedMarkerId) return null;
  
  const marker = mapMarkers.find(m => m.id === selectedMarkerId);
  if (!marker) return null;

  return (
    <>
      {activeBottomSheet === 'drop' && marker.type === 'drop' && <DropSheet marker={marker} onClose={() => setActiveBottomSheet('none')} />}
      {activeBottomSheet === 'event' && marker.type === 'event' && <EventSheet marker={marker} onClose={() => setActiveBottomSheet('none')} />}
      {activeBottomSheet === 'place' && marker.type === 'place' && <PlaceSheet marker={marker} onClose={() => setActiveBottomSheet('none')} />}
      {activeBottomSheet === 'quest' && marker.type === 'quest' && <QuestSheet marker={marker} onClose={() => setActiveBottomSheet('none')} />}
      {activeBottomSheet === 'profile' && marker.type === 'person' && <ProfileSheet marker={marker} onClose={() => setActiveBottomSheet('none')} />}
    </>
  );
}

function DropSheet({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const data = marker.data as MapMarker['data'] & { dropId: string; tokenSymbol: string; tokenIconUrl: string; amountPerClaim: bigint; claimsRemaining: number };
  const drop = getDrop(data.dropId);
  const token = getToken(drop?.tokenId || '');
  
  if (!drop) return null;

  const isClaimed = drop.claimedBy.includes('demo-user-1');
  const isEligible = (data as any).isEligible && !isClaimed && drop.status === 'active' && drop.currentClaimants < drop.maxClaimants;
  const timeLeft = drop.endTime - Date.now();

  const handleClaim = async () => {
    // TODO: Implement actual claim with smart contract
    console.log('Claiming drop:', drop.id);
    onClose();
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <img src={data.tokenIconUrl} alt={data.tokenSymbol} className="h-12 w-12 rounded-xl" />
            <div>
              <SheetTitle className="text-xl">{data.tokenSymbol} DROP</SheetTitle>
              <SheetDescription>{token?.description || 'Claim tokens at this location'}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white">
              <p className="text-2xl font-bold">{formatTokenAmount(data.amountPerClaim)}</p>
              <p className="text-xs opacity-90">PER CLAIM</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 text-white">
              <p className="text-2xl font-bold">{data.claimsRemaining}</p>
              <p className="text-xs opacity-90">REMAINING</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <p className="text-2xl font-bold">{formatTimeAgo(drop.endTime)}</p>
              <p className="text-xs opacity-90">TIME LEFT</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Total Pool</span>
              <span className="font-medium">{formatTokenAmount(drop.totalAmount)} {data.tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Claimed</span>
              <span className="font-medium">{drop.currentClaimants} / {drop.maxClaimants}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Radius</span>
              <span className="font-medium">{drop.radius}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <Badge variant={drop.status === 'active' ? 'success' : 'secondary'}>{drop.status}</Badge>
            </div>
          </div>

          {token && (
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { onClose(); setTimeout(() => useAppStore.getState().setActiveBottomSheet('token'), 100); }}>
              View {token.symbol} Token
            </Button>
          )}

          <Separator />

          <Button
            className="w-full"
            onClick={handleClaim}
            disabled={!isEligible || isClaimed}
            variant={isClaimed ? 'secondary' : 'default'}
            size="lg"
          >
            {isClaimed ? 'Already Claimed' : isEligible ? `Claim ${formatTokenAmount(data.amountPerClaim)} ${data.tokenSymbol}` : 'Not Eligible'}
          </Button>

          {!isEligible && !isClaimed && (
            <p className="text-center text-sm text-gray-500">
              {(data as any).isEligible ? 'Drop has ended or claimed out' : 'Move closer to claim this drop'}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EventSheet({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const data = marker.data as MapMarker['data'] & { eventId: string; name: string; startTime: number; tokenSymbol?: string; isActive: boolean };
  const event = getEvent(data.eventId);
  const token = data.tokenSymbol ? getToken(demoTokens.find(t => t.symbol === data.tokenSymbol)?.id || '') : undefined;

  if (!event) return null;

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{data.name}</SheetTitle>
              <SheetDescription>{event.description}</SheetDescription>
            </div>
            <Badge variant={data.isActive ? 'success' : 'secondary'} className="mt-1">
              {data.isActive ? 'Live Now' : 'Ended'}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>📍</span>
            <span>KICC, Nairobi</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>🕐</span>
            <span>{new Date(event.startTime).toLocaleDateString()} · {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {token && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Event Token: {token.symbol}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Earn {token.symbol} by participating in activities</p>
            </div>
          )}

          {event.drops.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Active Drops</h4>
              <div className="space-y-2">
                {event.drops.map(dropId => {
                  const drop = getDrop(dropId);
                  if (!drop) return null;
                  return (
                    <Button variant="outline" className="w-full justify-start gap-2" key={dropId} onClick={() => { onClose(); setTimeout(() => { useAppStore.getState().setSelectedMarkerId(`drop-${dropId}`); useAppStore.getState().setActiveBottomSheet('drop'); }, 100); }}>
                      🎁 {drop.tokenSymbol} — {formatTokenAmount(drop.amountPerClaim)} each
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {event.quests.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Quests</h4>
              <div className="space-y-2">
                {event.quests.map(questId => {
                  const quest = getQuest(questId);
                  if (!quest) return null;
                  return (
                    <Button variant="ghost" className="w-full justify-start gap-2" key={questId} onClick={() => { onClose(); setTimeout(() => { useAppStore.getState().setSelectedMarkerId(`quest-${questId}`); useAppStore.getState().setActiveBottomSheet('quest'); }, 100); }}>
                      🏆 {quest.title}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {event.sponsors.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Sponsors</h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {event.sponsors.map(sponsor => (
                  <div key={sponsor.id} className="flex-shrink-0">
                    <img src={sponsor.logoUrl} alt={sponsor.name} className="h-10 w-10 rounded-xl" />
                    <p className="text-xs text-center mt-1 max-w-[80px]">{sponsor.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PlaceSheet({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const data = marker.data as MapMarker['data'] & { placeId: string; name: string; category: string; iconUrl: string; hasActiveDrops: boolean };
  const place = getPlace(data.placeId);

  if (!place) return null;

  const categoryIcons = { venue: '🏢', food: '☕', shop: '🛍️', activity: '🎮', landmark: '🗼', community: '👥' };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-2xl">
              {categoryIcons[place.category as keyof typeof categoryIcons] || '📍'}
            </div>
            <div>
              <SheetTitle className="text-xl">{data.name}</SheetTitle>
              <SheetDescription>{place.description}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Badge variant="outline" size="sm">{place.category}</Badge>
          </div>

          {place.drops.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Available Drops</h4>
              <div className="space-y-2">
                {place.drops.map(dropId => {
                  const drop = getDrop(dropId);
                  if (!drop) return null;
                  return (
                    <Button variant="outline" className="w-full justify-start gap-2" key={dropId} onClick={() => { onClose(); setTimeout(() => { useAppStore.getState().setSelectedMarkerId(`drop-${dropId}`); useAppStore.getState().setActiveBottomSheet('drop'); }, 100); }}>
                      🎁 {drop.tokenSymbol} — {formatTokenAmount(drop.amountPerClaim)} each
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {place.drops.length === 0 && (
            <p className="text-center text-gray-500 py-4">No active drops at this location</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QuestSheet({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const data = marker.data as MapMarker['data'] & { questId: string; title: string; progress: number; totalTasks: number };
  const quest = getQuest(data.questId);
  const rewardToken = getToken(quest?.rewardTokenId || '');

  if (!quest) return null;

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{data.title}</SheetTitle>
              <SheetDescription>{quest.description}</SheetDescription>
            </div>
            <Badge variant="gradient" size="lg">
              Reward: {formatTokenAmount(quest.rewardAmount)} {rewardToken?.symbol || ''}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500" style={{ width: `${(data.progress / data.totalTasks) * 100}%` }} />
            </div>
            <span className="text-sm font-medium text-gray-500">{data.progress}/{data.totalTasks}</span>
          </div>

          <div className="space-y-2">
            {quest.tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${task.completed ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                  {task.completed && <span className="text-white text-xs">✓</span>}
                </div>
                <span className="text-sm {task.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}">{task.targetName}</span>
              </div>
            ))}
          </div>

          <Button className="w-full" variant="outline" disabled={data.progress < data.totalTasks}>
            {data.progress >= data.totalTasks ? 'Claim Reward' : 'Complete all tasks to claim'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProfileSheet({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
  const data = marker.data as MapMarker['data'] & { userId: string; username: string; avatarUrl: string; tokenSymbol?: string; distance: number };
  const person = getPerson(data.userId) as any;

  if (!person) return null;

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh]">
        <SheetHeader>
          <div className="flex items-center gap-4">
            <AvatarDisplay name={data.username} walletAddress={data.userId} size="xl" />
            <div className="flex-1">
              <SheetTitle className="text-xl">{data.username}</SheetTitle>
              <SheetDescription>{formatDistanceToNow(new Date(Date.now() - data.distance * 1000))} away · {person.status}</SheetDescription>
            </div>
            {data.tokenSymbol && (
              <Badge variant="gradient">Holds {data.tokenSymbol}</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { /* Tip flow */ onClose(); }}>
              Tip Tokens
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => { /* Message flow */ onClose(); }}>
              Say Hi
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => { /* View profile */ onClose(); }}>
              View Profile
            </Button>
          </div>

          {person.tokenSymbol && (
            <Button variant="ghost" className="w-full justify-start" onClick={() => { onClose(); setTimeout(() => useAppStore.getState().setActiveBottomSheet('token'), 100); }}>
              View {person.tokenSymbol} Token
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}