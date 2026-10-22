'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hexToBytes, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
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
import { CHAIN } from '@/lib/chain';
import { friendlyError, withTimeout } from '@/lib/friendly-error';
import { prepareChatImage } from '../lib/compress-image';

const CONNECT_TIMEOUT_MS = 20_000;

export type MessageDelivery = 'sending' | 'sent' | 'failed';

export interface XmtpUiMessage {
  id: string;
  conversationId: string;
  senderInboxId: string;
  sentAt: Date;
  mine: boolean;
  text: string;
  attachment?: Attachment;
  delivery: MessageDelivery;
}

export interface XmtpThread {
  id: string;
  peerInboxId: string;
  peerAddress: string | null;
  lastMessage: XmtpUiMessage | null;
  conversation: Dm<unknown>;
}

const VISIBLE_CONSENT = [ConsentState.Allowed, ConsentState.Unknown];

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
    delivery: 'sent',
  };
}

function sortThreads(items: XmtpThread[]) {
  return items.slice().sort((left, right) => (right.lastMessage?.sentAt.getTime() ?? 0) - (left.lastMessage?.sentAt.getTime() ?? 0));
}

export function useXmtpChat(enabled: boolean, notifyIncoming: (message: string) => void) {
  const { address, connector, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const clientRef = useRef<Client | null>(null);
  const streamRef = useRef<{ end: () => Promise<unknown> } | null>(null);
  const notifyRef = useRef(notifyIncoming);
  const activeThreadRef = useRef<string | null>(null);
  const signerAddressRef = useRef<string | null>(null);
  const conversationsRef = useRef(new Map<string, Dm<unknown>>());
  const peerAddressesRef = useRef(new Map<string, string>());
  const connectLockRef = useRef<Promise<void> | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [threads, setThreads] = useState<XmtpThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<XmtpUiMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  notifyRef.current = notifyIncoming;
  activeThreadRef.current = activeThreadId;

  const rememberThreads = useCallback((nextThreads: XmtpThread[]) => {
    for (const item of nextThreads) conversationsRef.current.set(item.id, item.conversation);
    setThreads(sortThreads(nextThreads));
  }, []);

  const refreshThreads = useCallback(async (activeClient: Client) => {
    await activeClient.conversations.sync();
    const dms = await activeClient.conversations.listDms({ consentStates: VISIBLE_CONSENT });
    const nextThreads = await Promise.all(dms.map(async (conversation) => {
      const [peerInboxId, history] = await Promise.all([
        conversation.peerInboxId(),
        conversation.messages({ limit: BigInt(1) }),
      ]);
      const lastMessage = history[0] ? toUiMessage(history[0], activeClient.inboxId ?? '') : null;
      return {
        id: conversation.id,
        peerInboxId,
        peerAddress: peerAddressesRef.current.get(conversation.id) ?? null,
        lastMessage,
        conversation,
      };
    }));
    rememberThreads(nextThreads);
  }, [rememberThreads]);

  const applyStreamedMessage = useCallback((uiMessage: XmtpUiMessage, activeClient: Client) => {
    setThreads((current) => {
      const known = current.some((item) => item.id === uiMessage.conversationId);
      if (!known) {
        void refreshThreads(activeClient);
        return current;
      }
      return sortThreads(current.map((item) => item.id === uiMessage.conversationId
        ? { ...item, lastMessage: uiMessage }
        : item));
    });
    setMessages((current) => {
      if (activeThreadRef.current !== uiMessage.conversationId) return current;
      if (current.some((item) => item.id === uiMessage.id)) return current;
      if (uiMessage.mine) {
        const pendingIndex = current.findIndex((item) => item.delivery === 'sending' && item.text === uiMessage.text);
        if (pendingIndex >= 0) {
          const next = current.slice();
          next[pendingIndex] = uiMessage;
          return next;
        }
      }
      return [...current, uiMessage];
    });
    if (!uiMessage.mine) {
      notifyRef.current(uiMessage.attachment
        ? `New attachment: ${uiMessage.attachment.filename ?? 'file'}`
        : `New message: ${uiMessage.text.slice(0, 72)}`);
    }
  }, [refreshThreads]);

  const connectWithSigner = useCallback(async (signer: Signer, signerAddress: string) => {
    if (connectLockRef.current) return connectLockRef.current;
    const run = (async () => {
    setStatus('connecting');
    setError('');
    let created: Client | null = null;
    try {
      if (clientRef.current && signerAddressRef.current === signerAddress.toLowerCase()) {
        await refreshThreads(clientRef.current);
        setStatus('ready');
        return;
      }
      if (clientRef.current) {
        const previousClient = clientRef.current;
        const previousStream = streamRef.current;
        clientRef.current = null;
        streamRef.current = null;
        signerAddressRef.current = null;
        conversationsRef.current.clear();
        peerAddressesRef.current.clear();
        setClient(null);
        setConnectedAddress(null);
        setThreads([]);
        try {
          await previousStream?.end();
        } finally {
          previousClient.close();
        }
      }

      const xmtpEnv = process.env.NEXT_PUBLIC_XMTP_ENV === 'production' ? 'production' : 'dev';
      // v7 already registers text, attachment, remote attachment, reply, reaction, and transaction reference.
      const clientOptions = { env: xmtpEnv, disableAutoRegister: false };
      created = await withTimeout(
        Client.create(signer, clientOptions),
        CONNECT_TIMEOUT_MS,
        'Messages took too long to sign in. Check your connection and try again.',
      );
      await withTimeout(
        refreshThreads(created),
        CONNECT_TIMEOUT_MS,
        'Messages signed in, but the inbox did not load. Try again.',
      );
      const activeClient = created;
      const stream = await activeClient.conversations.streamAllMessages({
        consentStates: VISIBLE_CONSENT,
        onValue: (message) => {
          applyStreamedMessage(toUiMessage(message, activeClient.inboxId ?? ''), activeClient);
        },
        onError: (streamError) => {
          setError(streamError.message);
        },
      });
      clientRef.current = created;
      signerAddressRef.current = signerAddress.toLowerCase();
      streamRef.current = stream;
      setClient(activeClient);
      setConnectedAddress(signerAddress.toLowerCase());
      setStatus('ready');
    } catch (cause) {
      created?.close();
      if (clientRef.current === created) clientRef.current = null;
      setStatus('error');
      setError(friendlyError(cause, 'Messages could not sign in. Try again.'));
    }
    })();
    connectLockRef.current = run;
    try {
      await run;
    } finally {
      connectLockRef.current = null;
    }
  }, [applyStreamedMessage, refreshThreads]);

  const connect = useCallback(async () => {
    if (!address || !walletClient) {
      setError('Connect an Ethereum wallet first.');
      return;
    }
    const signer: Signer = connector?.id.toLowerCase().includes('coinbase')
      ? createSCWSigner(
          address as Address,
          async (message) => walletClient.signMessage({ account: walletClient.account, message }),
          BigInt(chainId ?? CHAIN.id),
        )
      : {
          type: 'EOA',
          getIdentifier: () => ({ identifier: address, identifierKind: IdentifierKind.Ethereum }),
          signMessage: async (message) => hexToBytes(await walletClient.signMessage({ account: walletClient.account, message })),
        };
    await connectWithSigner(signer, address);
  }, [address, chainId, connector, connectWithSigner, walletClient]);

  const connectWithLocalWallet = useCallback(async (privateKey: Hex, expectedAddress: string) => {
    try {
      const account = privateKeyToAccount(privateKey);
      if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new Error('This key does not match the wallet saved to your passkey account.');
      }
      const signer: Signer = {
        type: 'EOA',
        getIdentifier: () => ({ identifier: account.address, identifierKind: IdentifierKind.Ethereum }),
        signMessage: async (message) => hexToBytes(await account.signMessage({ message })),
      };
      await connectWithSigner(signer, account.address);
    } catch (cause) {
      setStatus('error');
      setError(friendlyError(cause, 'Messages could not sign in. Try again.'));
      throw cause;
    }
  }, [connectWithSigner]);

  const resetStatus = useCallback(() => {
    setStatus('idle');
    setError('');
  }, []);

  useEffect(() => {
    if (!enabled || !client || !activeThreadId) {
      setMessages([]);
      return;
    }
    const conversation = conversationsRef.current.get(activeThreadId);
    if (!conversation) return;
    let cancelled = false;
    void (async () => {
      try {
        await conversation.sync();
        const history = await conversation.messages();
        if (!cancelled) {
          setMessages((current) => {
            const pending = current.filter((item) => item.delivery !== 'sent');
            const confirmed = history.map((message) => toUiMessage(message, client.inboxId ?? ''));
            const confirmedTexts = new Set(confirmed.map((item) => item.text));
            return [...confirmed, ...pending.filter((item) => !confirmedTexts.has(item.text))];
          });
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load this conversation.');
      }
    })();
    return () => { cancelled = true; };
  }, [activeThreadId, client, enabled]);

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
    conversationsRef.current.set(conversation.id, conversation);
    peerAddressesRef.current.set(conversation.id, normalized.toLowerCase());
    await refreshThreads(client);
    setActiveThreadId(conversation.id);
    return conversation;
  }, [client, refreshThreads]);

  const sendText = useCallback(async (text: string, retryId?: string) => {
    const conversationId = activeThreadRef.current;
    const conversation = conversationId ? conversationsRef.current.get(conversationId) : undefined;
    const body = text.trim();
    if (!conversation || !conversationId || !body) return;
    const localId = retryId ?? `local-${crypto.randomUUID()}`;
    const optimistic: XmtpUiMessage = {
      id: localId,
      conversationId,
      senderInboxId: client?.inboxId ?? '',
      sentAt: new Date(),
      mine: true,
      text: body,
      delivery: 'sending',
    };
    setMessages((current) => retryId
      ? current.map((item) => item.id === retryId ? { ...item, delivery: 'sending', sentAt: new Date() } : item)
      : [...current, optimistic]);
    setSending(true);
    try {
      const sentId = await conversation.sendText(body);
      setMessages((current) => current.map((item) => item.id === localId ? { ...item, id: sentId, delivery: 'sent' } : item));
    } catch (cause) {
      setMessages((current) => current.map((item) => item.id === localId ? { ...item, delivery: 'failed' } : item));
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }, [client]);

  const retryMessage = useCallback(async (messageId: string) => {
    const failed = messages.find((item) => item.id === messageId && item.delivery === 'failed');
    if (!failed) return;
    await sendText(failed.text, failed.id);
  }, [messages, sendText]);

  const sendAttachment = useCallback(async (file: File) => {
    const conversationId = activeThreadRef.current;
    const conversation = conversationId ? conversationsRef.current.get(conversationId) : undefined;
    if (!conversation) throw new Error('Open a conversation first.');
    setSending(true);
    try {
      const prepared = file.type.startsWith('image/') ? await prepareChatImage(file) : file;
      if (prepared.size > 950 * 1024) {
        throw new Error('That file is still too large to send in a message.');
      }
      await conversation.sendAttachment({
        filename: prepared.name,
        mimeType: prepared.type || 'application/octet-stream',
        content: new Uint8Array(await prepared.arrayBuffer()),
      });
    } finally {
      setSending(false);
    }
  }, []);

  const refresh = useCallback(() => client ? refreshThreads(client) : Promise.resolve(), [client, refreshThreads]);

  const resolveInbox = useCallback(async (inboxId: string) => {
    const current = clientRef.current;
    if (!current) return null;
    const states = await current.preferences.getInboxStates([inboxId]);
    const ethereum = states[0]?.accountIdentifiers.find((item) => item.identifierKind === IdentifierKind.Ethereum);
    return ethereum?.identifier.toLowerCase() ?? null;
  }, []);

  return useMemo(() => ({
    address,
    isWalletConnected: isConnected,
    client,
    connectedAddress,
    threads,
    activeThreadId,
    setActiveThreadId,
    messages,
    status,
    error,
    sending,
    connect,
    connectWithLocalWallet,
    resetStatus,
    startConversation,
    sendText,
    retryMessage,
    sendAttachment,
    refresh,
    resolveInbox,
  }), [
    address,
    isConnected,
    client,
    connectedAddress,
    threads,
    activeThreadId,
    messages,
    status,
    error,
    sending,
    connect,
    connectWithLocalWallet,
    resetStatus,
    startConversation,
    sendText,
    retryMessage,
    sendAttachment,
    refresh,
    resolveInbox,
  ]);
}
