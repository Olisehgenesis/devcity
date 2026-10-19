'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowLeftRight, ChevronDown, Copy, History, LogOut, Settings, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type WalletNav = 'home' | 'activity' | 'swap' | 'drops' | 'settings';

interface WalletShellProps {
  nav: WalletNav;
  title: string;
  subtitle?: string;
  /** Send, receive, and token screens keep the sidebar but hide the phone tab bar. */
  flow?: boolean;
  accountName: string;
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
          <Button type="button" variant="outline" className="wshell-close" onClick={onClose}>
            <X size={16} /> Close
          </Button>
        )}
      </aside>

      <div className="wallet-main">
        <header className="wshell-head">
          <div className="wshell-brand">
            {flow && onBack ? (
              <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={onBack} aria-label="Back">
                <ArrowLeft size={16} />
              </Button>
            ) : (
              <img src="/devcity-mark.svg" alt="" width={28} height={28} />
            )}
            <div className="wshell-brand-copy">
              <strong>devcity</strong>
              <span>{accountName}</span>
              <small>{chainLabel}</small>
            </div>
          </div>
          <div className="wshell-heading">
            {flow && onBack && (
              <Button type="button" variant="outline" size="icon" className="wshell-back rounded-full" onClick={onBack} aria-label="Back">
                <ArrowLeft size={16} />
              </Button>
            )}
            <div>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <div className="wshell-account" ref={menuRef}>
            <button
              type="button"
              className="wshell-account-btn"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="wshell-avatar" aria-hidden="true">{(accountName || 'W').slice(0, 1).toUpperCase()}</span>
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
                    <X size={15} aria-hidden="true" /> Close wallet
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
