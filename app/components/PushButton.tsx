import type { ButtonHTMLAttributes } from 'react';

type PushButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Raised button: the dark edge stays put and the face presses down. */
export function PushButton({ className = '', children, type = 'button', ...props }: PushButtonProps) {
  return (
    <button type={type} className={`push-button ${className}`.trim()} {...props}>
      <span className="button_top">{children}</span>
    </button>
  );
}
