'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

type Item = { id: string; code?: string; name: string };

export function PriceListItemPicker({
  items,
  selectedId,
  onSelect,
  label = 'Item',
  placeholder = 'Search or choose an item…',
  name,
  showCode = true,
}: {
  items: Item[];
  selectedId: string;
  onSelect: (id: string) => void;
  label?: string;
  placeholder?: string;
  name?: string;
  showCode?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerInList = useRef(false);
  const listId = useId();
  const selected = items.find(item => item.id === selectedId);
  const matches = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return search
      ? items.filter(item => `${item.code || ''} ${item.name}`.toLocaleLowerCase().includes(search))
      : items;
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      selectedId || !query ? '' : `Select ${label === 'Item' ? 'an' : 'a'} ${label.toLowerCase()} from the list.`,
    );
  }, [selectedId, query]);

  useEffect(() => {
    if (open) {
      listRef.current?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  const choose = (item: Item) => {
    onSelect(item.id);
    setQuery('');
    setOpen(false);
    inputRef.current?.setCustomValidity('');
    inputRef.current?.blur();
  };

  return (
    <div className="price-list-item-field" ref={rootRef}>
      <label htmlFor={`${listId}-input`}>{label}</label>
      {name && <input type="hidden" name={name} value={selectedId} />}
      <input
        id={`${listId}-input`}
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && matches.length ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        value={query || (selected ? showCode && selected.code ? `${selected.code} — ${selected.name}` : selected.name : '')}
        onFocus={event => { setQuery(''); setActiveIndex(0); setOpen(true); event.currentTarget.select(); }}
        onChange={event => { onSelect(''); setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
        onBlur={event => {
          if (!pointerInList.current && !rootRef.current?.contains(event.relatedTarget)) {
            setOpen(false);
            setQuery('');
          }
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          if (event.key === 'ArrowDown' && matches.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => Math.min(index + 1, matches.length - 1));
          }
          if (event.key === 'ArrowUp' && matches.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex(index => Math.max(index - 1, 0));
          }
          if (event.key === 'Enter' && open && matches[activeIndex]) {
            event.preventDefault();
            choose(matches[activeIndex]);
          }
        }}
        placeholder={placeholder}
        required
      />
      {open && (
        <div className="price-list-item-list" id={listId} role="listbox" ref={listRef} aria-label={`Available ${label.toLowerCase()} options`} onPointerDownCapture={() => { pointerInList.current = true; }} onPointerUpCapture={() => { pointerInList.current = false; }} onPointerCancelCapture={() => { pointerInList.current = false; }}>
          {matches.length ? matches.map((item, index) => (
            <button
              type="button"
              role="option"
              tabIndex={-1}
              id={`${listId}-${index}`}
              data-option-index={index}
              aria-selected={item.id === selectedId}
              data-mutation-guard-ignore
              className={`${index === activeIndex ? 'active' : ''}${showCode && item.code ? '' : ' no-code'}`}
              key={item.id}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item)}
            >
              {showCode && item.code && <span className="price-list-item-code">{item.code}</span>}
              <span className="price-list-item-name">{item.name}</span>
            </button>
          )) : <p>No matching {label.toLowerCase()}{label === 'Item' ? 's' : ''}.</p>}
        </div>
      )}
    </div>
  );
}

export { PriceListItemPicker as SearchableSelect };

export function FormSearchableSelect({
  initialValue = '',
  ...props
}: {
  items: Item[];
  initialValue?: string;
  label: string;
  placeholder: string;
  name: string;
}) {
  const [selectedId, setSelectedId] = useState(initialValue);
  return <PriceListItemPicker {...props} selectedId={selectedId} onSelect={setSelectedId} />;
}
