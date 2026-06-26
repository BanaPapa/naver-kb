import React, { useEffect, useMemo, useState } from 'react';
import { getAdminRoleTip, useAdminUi } from './admin-ui';

type ControlButtonVariant = 'primary' | 'secondary';

interface ControlSectionProps {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerRight?: React.ReactNode;
  style?: React.CSSProperties;
}

interface ControlFieldProps {
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

type ControlSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

type ControlButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ControlButtonVariant;
};

const TITLE_OVERRIDE_KEY = 'control_panel_title_overrides_v1';

function readTitleOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TITLE_OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTitleOverride(key: string, value: string) {
  try {
    const next = readTitleOverrides();
    if (value.trim()) next[key] = value.trim();
    else delete next[key];
    localStorage.setItem(TITLE_OVERRIDE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable: keep the live component state only.
  }
}

function useEditableTitle(title: React.ReactNode) {
  const key = typeof title === 'string' ? title : null;
  const [value, setValue] = useState(() => {
    if (!key) return '';
    return readTitleOverrides()[key] ?? key;
  });

  useEffect(() => {
    if (!key) return;
    setValue(readTitleOverrides()[key] ?? key);
  }, [key]);

  const update = (next: string) => {
    setValue(next);
    if (key) writeTitleOverride(key, next);
  };

  return { key, value, update };
}

export function ControlSection({
  title,
  children,
  className = '',
  contentClassName = '',
  headerRight,
  style,
}: ControlSectionProps) {
  const { isAdmin } = useAdminUi();
  const { key: editableKey, value: editableTitle, update: updateTitle } = useEditableTitle(title);
  const [editing, setEditing] = useState(false);
  const hasTitle = title !== undefined && title !== null && title !== '';
  const titleNode = useMemo(() => {
    if (!hasTitle) return null;
    if (!editableKey) return title;
    if (editing) {
      return (
        <input
          className="ctrl-title-edit"
          value={editableTitle}
          autoFocus
          onChange={(e) => updateTitle(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              updateTitle(editableKey);
              setEditing(false);
            }
          }}
        />
      );
    }
    return editableTitle;
  }, [editableKey, editableTitle, editing, hasTitle, title]);

  const header = headerRight || hasTitle ? (
    <div className="ctrl-section-head">
      {hasTitle && (
        <h2
          className="ctrl-section-title"
          data-admin-role-tip={getAdminRoleTip(isAdmin, '제목', editableKey ? editableTitle : title)}
          onDoubleClick={() => {
            if (isAdmin && editableKey) setEditing(true);
          }}
        >
          {titleNode}
        </h2>
      )}
      {headerRight}
    </div>
  ) : (
    null
  );

  return (
    <section className={`ctrl-section ${className}`.trim()} style={style}>
      {header}
      {contentClassName ? <div className={contentClassName}>{children}</div> : children}
    </section>
  );
}

export function ControlField({ label, children, className = '' }: ControlFieldProps) {
  const { isAdmin } = useAdminUi();
  return (
    <div className={`ctrl-field ${className}`.trim()}>
      {label && (
        <label
          className="ctrl-field-label"
          data-admin-role-tip={getAdminRoleTip(isAdmin, '설명글', label)}
        >
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

export function ControlSelect({ wrapperClassName = '', className = '', children, ...props }: ControlSelectProps) {
  const { isAdmin } = useAdminUi();
  return (
    <div
      className={`select-wrapper ${wrapperClassName}`.trim()}
      data-admin-role-tip={getAdminRoleTip(isAdmin, '항목', props.title)}
    >
      <select className={`form-select ${className}`.trim()} {...props}>
        {children}
      </select>
    </div>
  );
}

export function ControlButton({
  variant = 'secondary',
  className = '',
  children,
  title,
  ...props
}: ControlButtonProps) {
  const { isAdmin } = useAdminUi();
  const variantClass = variant === 'primary' ? 'ctrl-button-2 ctrl-primary-action' : 'ctrl-button-1 ctrl-secondary-action';
  const roleLabel = variant === 'primary' ? '버튼2' : '버튼1';
  return (
    <button
      className={`${variantClass} ${className}`.trim()}
      data-admin-role-tip={getAdminRoleTip(isAdmin, roleLabel, title ?? children)}
      title={isAdmin ? undefined : title}
      {...props}
    >
      {children}
    </button>
  );
}
