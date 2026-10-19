'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowLeftRight, ChevronDown, Copy, History, LogOut, Settings, Wallet } from 'lucide-react';

export type WalletNav = 'home' | 'activity' | 'swap' | 'drops' | 'settings';

interface WalletShellProps {
  nav: WalletNav;
  title: string;
  subtitle?: string;
  /** Send, receive, and token screens keep the sidebar but hide the phone tab bar. */
  flow?: boolean;
  accountName: string;
  avatarSrc: string;
  accountDetail: string;
  chainLabel: string;
  address: string;
  onNavigate: (nav: WalletNav) => void;
  onBack?: () => void;
  onClose?: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

const NAV: { id: WalletNav; label: string; icon: typeof Wallet }[] = [
  { id: 'home', label: 'Wallet', icon: Wallet },
  { id: 'activity', label: 'Activity', icon: History },
  { id: 'swap', label: 'Swap', icon: ArrowLeftRight },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function WalletShell({
  nav,
  title,
  subtitle,
  flow,
  accountName,
  avatarSrc,
  accountDetail,
  chainLabel,
  address,
  onNavigate,
  onBack,
  onClose,
  onSignOut,
  children,
}: WalletShellProps) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [menuOpen]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const home = nav === 'home' && !flow;
  const backToWallet = !home && Boolean(onBack);
  const backAction = backToWallet ? onBack : onClose;

  return (
    <div className={`wallet-app${home ? ' is-home' : ''}${flow ? ' is-flow' : ''}`}>
      <aside className="wshell-side">
        <div className="wshell-logo">
          <img src="/devcity-mark.svg" alt="" width={28} height={28} />
          <span>devcity</span>
        </div>
        <nav className="wshell-nav" aria-label="Wallet">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = nav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'is-active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
          <button
            type="button"
            className={nav === 'drops' ? 'is-active wshell-nav-sub' : 'wshell-nav-sub'}
            aria-current={nav === 'drops' ? 'page' : undefined}
            onClick={() => onNavigate('drops')}
          >
            Badges & drops
          </button>
        </nav>
        {onClose && (
          <button type="button" className="wshell-homeback wshell-close" onClick={onClose} aria-label="Back to the map">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        )}
      </aside>

      <div className="wallet-main">
        <header className="wshell-head">
          {backAction && (
            <button
              type="button"
              className="wshell-homeback"
              onClick={backAction}
              aria-label={backToWallet ? 'Back' : 'Back to the map'}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          )}
          {!flow && (
            <div className="wshell-brand">
              <img src="/devcity-mark.svg" alt="" width={28} height={28} />
              <div className="wshell-brand-copy">
                <strong>devcity</strong>
                <span>{accountName}</span>
                <small>{chainLabel}</small>
              </div>
            </div>
          )}
          <div className="wshell-heading">
            <div>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <div className="wshell-account" ref={menuRef}>
            <button
              type="button"
              className="wshell-account-btn"
              aria-label={`${accountName} account`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <img className="wshell-avatar" src={avatarSrc} alt="" />
              <span className="wshell-account-copy">
                <strong>{accountName}</strong>
                <span>{chainLabel} · {accountDetail}</span>
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className="wshell-menu" id={menuId} role="menu">
                <p className="wshell-menu-net"><i aria-hidden="true" /> {chainLabel}</p>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); void copyAddress(); }}>
                  <Copy size={15} aria-hidden="true" /> {copied ? 'Copied' : 'Copy address'}
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onNavigate('settings'); }}>
                  <Settings size={15} aria-hidden="true" /> Settings
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onSignOut(); }}>
                  <LogOut size={15} aria-hidden="true" /> Sign out
                </button>
                {onClose && (
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onClose(); }}>
                    <ArrowLeft size={15} aria-hidden="true" /> Back to the map
                  </button>
                )}
              </div>
            )}
          </div>
        </header>
        <div className="wallet-main-body">{children}</div>
      </div>

      <nav className="wshell-tabbar" aria-label="Wallet">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = nav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? 'is-active' : ''}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
