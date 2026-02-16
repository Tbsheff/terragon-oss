"use client";

import { atom, useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export type FileInfo = {
  path: string;
  content: string;
  language: string;
};

export type DiffInfo = {
  path: string;
  oldString: string;
  newString: string;
};

export type FilePanelTab = "viewer" | "diff" | "tree";

// ─────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────

export const filePanelOpenAtom = atom(false);
export const selectedFileAtom = atom<FileInfo | null>(null);
export const selectedDiffAtom = atom<DiffInfo | null>(null);
export const filePanelTabAtom = atom<FilePanelTab>("tree");

// ─────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────

/** Full panel state + setters */
export function useFilePanel() {
  const [isOpen, setIsOpen] = useAtom(filePanelOpenAtom);
  const [tab, setTab] = useAtom(filePanelTabAtom);
  const [selectedFile, setSelectedFile] = useAtom(selectedFileAtom);
  const [selectedDiff, setSelectedDiff] = useAtom(selectedDiffAtom);

  const close = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, [setIsOpen]);

  return {
    isOpen,
    setIsOpen,
    tab,
    setTab,
    selectedFile,
    setSelectedFile,
    selectedDiff,
    setSelectedDiff,
    close,
    toggle,
  };
}

/** Open a file in the viewer tab */
export function useOpenFile() {
  const setIsOpen = useSetAtom(filePanelOpenAtom);
  const setFile = useSetAtom(selectedFileAtom);
  const setTab = useSetAtom(filePanelTabAtom);

  return useCallback(
    (file: FileInfo) => {
      setFile(file);
      setTab("viewer");
      setIsOpen(true);
    },
    [setFile, setTab, setIsOpen],
  );
}

/** Open a diff in the diff tab */
export function useOpenDiff() {
  const setIsOpen = useSetAtom(filePanelOpenAtom);
  const setDiff = useSetAtom(selectedDiffAtom);
  const setTab = useSetAtom(filePanelTabAtom);

  return useCallback(
    (diff: DiffInfo) => {
      setDiff(diff);
      setTab("diff");
      setIsOpen(true);
    },
    [setDiff, setTab, setIsOpen],
  );
}
