'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hexToBytes, type Address } from 'viem';
import { useAccount, useWalletClient } from 'wagmi';
import {
  Client,
  ConsentState,
  IdentifierKind,
  createSCWSigner,
  isAttachment,
  type Attachment,
  type DecodedMessage,
  type Dm,
  type Signer,
} from '@xmtp/browser-sdk';

export interface XmtpUiMessage {
  id: string;
  conversationId: string;
  senderInboxId: string;
  sentAt: Date;
  mine: boolean;
  text: string;
  attachment?: Attachment;
}

export interface XmtpThread {
  id: string;
  peerInboxId: string;
  lastMessage: XmtpUiMessage | null;
  conversation: Dm<unknown>;
}

function toUiMessage(message: DecodedMessage, selfInboxId: string): XmtpUiMessage {
  const attachment = isAttachment(message) ? message.content : undefined;
  const text = typeof message.content === 'string'
    ? message.content
    : attachment?.filename
      ? `Attachment: ${attachment.filename}`
      : message.fallback ?? 'Unsupported message';

  return {
    id: message.id,
    conversationId: message.conversationId,
    senderInboxId: message.senderInboxId,
    sentAt: message.sentAt,
    mine: message.senderInboxId === selfInboxId,
    text,
    attachment,
  };
}

export function useXmtpChat(enabled: boolean, notifyIncoming: (message: string) => void) {
  const { address, connector, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const clientRef = useRef<Client | null>(null);
  const streamRef = useRef<{ end: () => Promise<unknown> } | null>(null);
  const notifyRef = useRef(notifyIncoming);
  const activeThreadRef = useRef<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [threads, setThreads] = useState<XmtpThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<XmtpUiMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  notifyRef.current = notifyIncoming;
  activeThreadRef.current = activeThreadId;

  const refreshThreads = useCallback(async (activeClient: Client) => {
    await activeClient.conversations.sync();
    const dms = await activeClient.conversations.listDms({ consentStates: [ConsentState.Allowed] });
    const nextThreads = await Promise.all(dms.map(async (conversation) => {
      const [peerInboxId, history] = await Promise.all([
        conversation.peerInboxId(),
        conversation.messages({ limit: BigInt(1) }),
      ]);
      const lastMessage = history[0] ? toUiMessage(history[0], activeClient.inboxId ?? '') : null;
      return { id: conversation.id, peerInboxId, lastMessage, conversation };
    }));
    setThreads(nextThreads.sort((left, right) => (right.lastMessage?.sentAt.getTime() ?? 0) - (left.lastMessage?.sentAt.getTime() ?? 0)));
  }, []);

  const connect = useCallback(async () => {
    if (!address || !walletClient) {
      setError('Connect an Ethereum wallet first.');
      return;
    }
    if (clientRef.current) return;

    setStatus('connecting');
    setError('');
    try {
      const signer: Signer = connector?.id.toLowerCase().includes('coinbase')
        ? createSCWSigner(
            address as Address,
            async (message) => walletClient.signMessage({ account: walletClient.account, message }),
            BigInt(chainId ?? 8453),
          )
        : {
            type: 'EOA',
            getIdentifier: () => ({ identifier: address, identifierKind: IdentifierKind.Ethereum }),
            signMessage: async (message) => hexToBytes(await walletClient.signMessage({ account: walletClient.account, message })),
          };

      const xmtpEnv = process.env.NEXT_PUBLIC_XMTP_ENV === 'production' ? 'production' : 'dev';
      const clientOptions = { env: xmtpEnv } as Omit<ConstructorParameters<typeof Client>[0], 'codecs'> & { codecs?: [] };
      const created = await Client.create<[]>(signer, clientOptions);
      clientRef.current = created;
      setClient(created);
      await refreshThreads(created);
      setStatus('ready');

      const stream = await created.conversations.streamAllMessages({
        consentStates: [ConsentState.Allowed],
        onValue: (message) => {
          const uiMessage = toUiMessage(message, created.inboxId ?? '');
          if (activeThreadRef.current === uiMessage.conversationId) {
            setMessages((current) => current.some((item) => item.id === uiMessage.id) ? current : [...current, uiMessage]);
          }
          if (!uiMessage.mine) {
            notifyRef.current(uiMessage.attachment
              ? `New attachment: ${uiMessage.attachment.filename ?? 'file'}`
              : `New message: ${uiMessage.text.slice(0, 72)}`);
          }
          void refreshThreads(created);
        },
        onError: (streamError) => {
          setError(streamError.message);
        },
      });
      streamRef.current = stream;
    } catch (cause) {
      setStatus('error');
      setError(cause instanceof Error ? cause.message : 'XMTP could not connect.');
    }
  }, [address, chainId, connector, refreshThreads, walletClient]);

  useEffect(() => {
    if (!enabled || !client || !activeThreadId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const thread = threads.find((item) => item.id === activeThreadId);
    if (!thread) return;

    void (async () => {
      try {
        await thread.conversation.sync();
        const history = await thread.conversation.messages();
        if (!cancelled) setMessages(history.map((message) => toUiMessage(message, client.inboxId ?? '')));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load this conversation.');
      }
    })();
    return () => { cancelled = true; };
  }, [activeThreadId, client, enabled, threads]);

  useEffect(() => () => {
    void streamRef.current?.end();
    clientRef.current?.close();
    streamRef.current = null;
    clientRef.current = null;
  }, []);

  const startConversation = useCallback(async (recipient: string) => {
    if (!client) throw new Error('Connect XMTP before starting a conversation.');
    const normalized = recipient.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalized)) throw new Error('Enter a valid Ethereum address.');
    const conversation = await client.conversations.createDmWithIdentifier({
      identifier: normalized,
      identifierKind: IdentifierKind.Ethereum,
    });
    await refreshThreads(client);
    setActiveThreadId(conversation.id);
    return conversation;
  }, [client, refreshThreads]);

  const sendText = useCallback(async (text: string) => {
    const conversation = threads.find((item) => item.id === activeThreadId)?.conversation;
    if (!conversation || !text.trim()) return;
    setSending(true);
    try {
      await conversation.sendText(text.trim());
    } finally {
      setSending(false);
    }
  }, [activeThreadId, threads]);

  const sendAttachment = useCallback(async (file: File) => {
    const conversation = threads.find((item) => item.id === activeThreadId)?.conversation;
    if (!conversation) throw new Error('Open a conversation first.');
    if (file.size > 950 * 1024) throw new Error('XMTP inline attachments must be smaller than 950 KB.');
    setSending(true);
    try {
      await conversation.sendAttachment({
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        content: new Uint8Array(await file.arrayBuffer()),
      });
    } finally {
      setSending(false);
    }
  }, [activeThreadId, threads]);

  return {
    address,
    isWalletConnected: isConnected,
    client,
    threads,
    activeThreadId,
    setActiveThreadId,
    messages,
    status,
    error,
    sending,
    connect,
    startConversation,
    sendText,
    sendAttachment,
    refresh: () => client ? refreshThreads(client) : Promise.resolve(),
  };
}
