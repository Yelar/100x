"use client"

import { ImperativePanelHandle } from "react-resizable-panels"
import { useRef, useCallback, useEffect } from "react"
import { useLocalStorage } from "./use-local-storage"

interface PanelLayout {
  emailListSize: number
  emailContentSize: number
}

export function useEmailPanelLayout() {
  const emailListRef = useRef<ImperativePanelHandle>(null)
  const emailContentRef = useRef<ImperativePanelHandle>(null)
  
  const [layout, setLayout] = useLocalStorage<PanelLayout>("email-two-panel-layout", {
    emailListSize: 35,
    emailContentSize: 65,
  })
  
  // Set panel sizes on component mount
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (emailListRef.current) emailListRef.current.resize(layout.emailListSize);
      if (emailContentRef.current) emailContentRef.current.resize(layout.emailContentSize);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [layout]);
  
  const onResize = useCallback((sizes: number[]) => {
    if (
      sizes.length === 2 &&
      (sizes[0] !== layout.emailListSize ||
      sizes[1] !== layout.emailContentSize)
    ) {
      setLayout({
        emailListSize: sizes[0],
        emailContentSize: sizes[1],
      });
    }
  }, [layout, setLayout]);
  
  return {
    refs: {
      emailListRef,
      emailContentRef,
    },
    sizes: {
      emailListSize: layout.emailListSize,
      emailContentSize: layout.emailContentSize,
    },
    onResize
  }
} 