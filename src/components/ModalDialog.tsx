import React from "react";
const focusable =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';
const dialogs: HTMLElement[] = [];
export function ModalDialog({
  label,
  onClose,
  children,
  className = "",
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const panel = React.useRef<HTMLElement>(null);
  const close = React.useRef(onClose);
  close.current = onClose;
  React.useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const element = panel.current;
    if (element) dialogs.push(element);
    (element?.querySelector<HTMLElement>(focusable) || element)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== element) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab" || !element) return;
      const items = Array.from(
        element.querySelectorAll<HTMLElement>(focusable),
      );
      if (!items.length) {
        event.preventDefault();
        element.focus();
        return;
      }
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      if (element) {
        const index = dialogs.indexOf(element);
        if (index >= 0) dialogs.splice(index, 1);
      }
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay">
      <section
        ref={panel}
        className={`modal ai-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  );
}
