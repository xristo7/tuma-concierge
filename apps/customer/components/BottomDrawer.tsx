"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";

export function BottomDrawer({
  isOpen,
  title,
  onClose,
  children,
}: {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <Modal title={title} onClose={onClose}>
      {children}
    </Modal>
  );
}
