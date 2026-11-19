import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface InventoryActionMenuProps {
  anchor: HTMLButtonElement | null;
  id: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}

export default function InventoryActionMenu({ anchor, id, label, onClose, children }: InventoryActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const rect = anchor.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const margin = 8;
      const below = rect.bottom + margin;
      const top = below + height <= window.innerHeight - margin
        ? below
        : Math.max(margin, rect.top - height - margin);
      const left = Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin));
      setPosition({ top, left, ready: true });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor]);

  useLayoutEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchor?.contains(target)) onClose();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      anchor?.focus();
      onClose();
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={menuRef} id={id} className="rx-inventory-action-menu" role="group" aria-label={label}
      style={{ top: position.top, left: position.left, visibility: position.ready ? "visible" : "hidden" }}>
      {children}
    </div>,
    document.body,
  );
}