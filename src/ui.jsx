export function FluentProvider({ children }) {
  return children;
}

export function Button({ appearance = "secondary", icon, className = "", children, ...props }) {
  return (
    <button className={`fui-Button button-${appearance} ${className}`} type="button" {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function Tooltip({ content, children }) {
  return <span className="tooltip-anchor" title={content}>{children}</span>;
}

export function Dialog({ open, onOpenChange, children }) {
  if (!open) return null;
  return (
    <div
      className="dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange?.(event, { open: false });
      }}
    >
      {children}
    </div>
  );
}

export function DialogSurface({ className = "", children }) {
  return <section className={`dialog-surface ${className}`} role="dialog" aria-modal="true">{children}</section>;
}

export function DialogBody({ children }) {
  return <div className="dialog-body">{children}</div>;
}

export function DialogTitle({ children }) {
  return <h2 className="dialog-title">{children}</h2>;
}

export function DialogContent({ children }) {
  return <div className="dialog-content">{children}</div>;
}

export function DialogActions({ children }) {
  return <div className="dialog-actions">{children}</div>;
}

export function Field({ label, hint, required, children }) {
  return (
    <label className="field-block">
      <span className="field-label">{label}{required ? <b aria-hidden="true"> *</b> : null}</span>
      {children}
      {hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}

export function Input({ value, onChange, contentBefore, ...props }) {
  return (
    <span className="input-shell">
      {contentBefore}
      <input value={value} onChange={(event) => onChange?.(event, { value: event.target.value })} {...props} />
    </span>
  );
}

export function Textarea({ value, onChange, resize, ...props }) {
  return (
    <textarea
      className="textarea-control"
      value={value}
      style={{ resize: resize || "none" }}
      onChange={(event) => onChange?.(event, { value: event.target.value })}
      {...props}
    />
  );
}

export function Switch({ checked, onChange, label }) {
  return (
    <label className="switch-control">
      <input type="checkbox" checked={checked} onChange={(event) => onChange?.(event, { checked: event.target.checked })} />
      <span className="switch-track"><span /></span>
      <strong>{label}</strong>
    </label>
  );
}

export function Checkbox({ checked, onChange, label }) {
  return (
    <label className="checkbox-control">
      <input type="checkbox" checked={checked} onChange={(event) => onChange?.(event, { checked: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
}
