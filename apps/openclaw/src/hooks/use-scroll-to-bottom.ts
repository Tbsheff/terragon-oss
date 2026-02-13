"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/**
 * Smart scroll hook for OpenClaw chat.
 * - MutationObserver detects new DOM content
 * - Auto-scrolls only when user is already at the bottom
 * - Scroll listener tracks isAtBottom (10px threshold)
 *
 * Adapted from apps/www useScrollToBottom but uses plain div (no Radix ScrollArea).
 */
export function useScrollToBottom(): {
  containerRef: RefObject<HTMLDivElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  isAtBottom: boolean;
  scrollToBottom: () => void;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const checkIsAtBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    isAtBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
    return atBottom;
  }, []);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Scroll listener — sync with external scroll position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    checkIsAtBottom();
    const onScroll = () => checkIsAtBottom();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [checkIsAtBottom]);

  // Scroll to bottom on mount
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  // MutationObserver — auto-scroll when new content appears (only if at bottom)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new MutationObserver(() => {
      if (isAtBottomRef.current) {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    });

    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return { containerRef, messagesEndRef: endRef, isAtBottom, scrollToBottom };
}
