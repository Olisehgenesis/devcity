'use client';

import { useEffect, useState } from 'react';
import { SelfAppBuilder, SelfQRcodeWrapper, getUniversalLink, type SelfApp } from '@selfxyz/qrcode';
import { Button } from '@/components/ui/button';

export type SelfLegacyQrConfig = {
  appName: string;
  scope: string;
  endpoint: string;
  endpointType: 'https' | 'staging_https';
  userId: string;
  userDefinedData: string;
  logo: string;
  returnUrl: string;
};

export function SelfLegacyQr({ config, onVerified }: { config: SelfLegacyQrConfig; onVerified: () => void }) {
  const [app, setApp] = useState<SelfApp | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const built = new SelfAppBuilder({
        version: 2,
        appName: config.appName,
        scope: config.scope,
        endpoint: config.endpoint,
        endpointType: config.endpointType,
        userId: config.userId,
        userIdType: 'uuid',
        userDefinedData: config.userDefinedData,
        logoBase64: config.logo,
        deeplinkCallback: config.returnUrl,
        disclosures: {},
      }).build();
      setApp(built);
      setError('');
    } catch (cause) {
      setApp(null);
      setError(cause instanceof Error ? cause.message : 'Could not open Self.');
    }
  }, [config]);

  if (error) return <p className="avatar-upload-error" role="alert">{error}</p>;
  if (!app) return <p className="you-note">Preparing the Self check…</p>;
  const link = getUniversalLink(app);

  return (
    <div className="self-qr-panel">
      <p>Open Self, then come back. The result arrives here from Self, or from the proof sent to DEVCITY.</p>
      <SelfQRcodeWrapper
        selfApp={app}
        size={220}
        onSuccess={onVerified}
        onError={() => setError('Self could not finish the check. Try again.')}
      />
      <Button asChild className="w-full">
        <a href={link}>Open the Self app</a>
      </Button>
    </div>
  );
}
