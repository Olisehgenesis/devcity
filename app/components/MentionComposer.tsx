'use client';

import { useEffect, useRef, useState } from 'react';
import { insertMention, mentionBeingTyped } from '@/lib/mentions';

type Person = { username: string; avatarUrl: string | null };

export function MentionComposer({
  value,
  onChange,
  placeholder,
  label,
  rows = 2,
  multiline = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  rows?: number;
  multiline?: boolean;
}) {
  const field = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    if (query == null) {
      setPeople([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/mentions?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : { people: [] })
        .then((data: { people?: Person[] }) => setPeople(data.people ?? []))
        .catch(() => undefined);
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function sync(next: string, caret: number) {
    onChange(next.slice(0, 240));
    setQuery(mentionBeingTyped(next, caret));
  }

  function pick(handle: string) {
    const caret = field.current?.selectionStart ?? value.length;
    const inserted = insertMention(value, caret, handle);
    onChange(inserted.text.slice(0, 240));
    setQuery(null);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(inserted.caret, inserted.caret);
    });
  }

  const shared = {
    ref: field as never,
    value,
    placeholder,
    'aria-label': label,
    onChange: (event: { target: { value: string; selectionStart: number | null } }) => sync(event.target.value, event.target.selectionStart ?? event.target.value.length),
    onBlur: () => window.setTimeout(() => setQuery(null), 120),
  };

  return (
    <div className="mention-field">
      {multiline
        ? <textarea {...shared} rows={rows} />
        : <input {...shared} />}
      {query != null && people.length > 0 && (
        <ul className="mention-menu" role="listbox" aria-label="Mention someone">
          {people.map((person) => (
            <li key={person.username}>
              <button type="button" onMouseDown={(event) => { event.preventDefault(); pick(person.username!); }}>@{person.username}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
