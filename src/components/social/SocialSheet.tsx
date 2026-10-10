'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { BroadcastFeed } from '@/components/social/BroadcastFeed';
import { ChatPanel } from '@/components/social/ChatPanel';
import { PeopleList } from '@/components/social/PeopleList';
import { useAppStore } from '@/lib/store';

type SocialTab = 'feed' | 'chat' | 'people';

export function SocialSheet() {
  const { activeBottomSheet, setActiveBottomSheet, addNotification } = useAppStore();
  const [tab, setTab] = useState<SocialTab>('feed');

  const open = activeBottomSheet === 'social';

  const handleClose = () => setActiveBottomSheet('none');

  const handleTip = (name: string) => {
    addNotification({ type: 'info', message: `Tip flow for ${name} — coming with the wallet backend` });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="bottom" className="max-h-[85vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-center">Around the city</SheetTitle>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as SocialTab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="feed" className="flex-1">Feed</TabsTrigger>
            <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
            <TabsTrigger value="people" className="flex-1">People</TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="flex-1 overflow-y-auto min-h-0 pb-4">
            <BroadcastFeed />
          </TabsContent>

          <TabsContent value="chat" className="flex-1 overflow-hidden min-h-0 pb-4">
            <ChatPanel />
          </TabsContent>

          <TabsContent value="people" className="flex-1 overflow-y-auto min-h-0 pb-4">
            <PeopleList onTip={handleTip} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
