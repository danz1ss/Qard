import React, { useEffect, useId, useRef, useState } from 'react';
import './Select.css';

interface Option { value: string; label: string; }
interface SelectProps {
  label?: string;
  error?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
  label, error, options, value, onChange, className = '', disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setActive(idx >= 0 ? idx : 0);
    }
  }, [open, value, options]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  };

  return (
    <div className={`select-wrapper ${className}`} ref={rootRef}>
      {label && <label className="select-label" htmlFor={`${id}-trigger`}>{label}</label>}
      <div className={`cselect ${error ? 'cselect-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
        <button
          type="button"
          id={`${id}-trigger`}
          className="cselect-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={onKeyDown}
        >
          <span className="cselect-value">{selected ? selected.label : ''}</span>
          <span className={`cselect-caret ${open ? 'is-open' : ''}`}>▾</span>
        </button>
        <ul ref={listRef} className={`cselect-list ${open ? 'is-open' : ''}`} role="listbox" tabIndex={-1} aria-hidden={!open}>
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`cselect-option ${i === active ? 'is-active' : ''} ${o.value === value ? 'is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      </div>
      {error && <span className="select-error-text">{error}</span>}
    </div>
  );
};

export default Select;
