"use client"

import { ImperativePanelHandle } from "react-resizable-panels"
import { useRef, useCallback, useEffect } from "react"
import { useLocalStorage } from "./use-local-storage"

interface PanelLayout {
  sidebarSize: number
  emailListSize: number
  emailContentSize: number
  chatSize: number
}

export function usePanelLayout() {
  const sidebarRef = useRef<ImperativePanelHandle>(null)
  const emailListRef = useRef<ImperativePanelHandle>(null)
  const emailContentRef = useRef<ImperativePanelHandle>(null)
  const chatRef = useRef<ImperativePanelHandle>(null)
  
  const [layout, setLayout] = useLocalStorage<PanelLayout>("email-panel-layout", {
    sidebarSize: 15,
    emailListSize: 25,
    emailContentSize: 40,
    chatSize: 20
  })
  
  // Set panel sizes on component mount
  useEffect(() => {
    // Small delay to ensure panels are ready
    const timeoutId = setTimeout(() => {
      if (sidebarRef.current) sidebarRef.current.resize(layout.sidebarSize);
      if (emailListRef.current) emailListRef.current.resize(layout.emailListSize);
      if (emailContentRef.current) emailContentRef.current.resize(layout.emailContentSize);
      if (chatRef.current) chatRef.current.resize(layout.chatSize);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [layout]);
  
  const onResize = useCallback((sizes: number[]) => {
    if (
      sizes[0] !== layout.sidebarSize ||
      sizes[1] !== layout.emailListSize ||
      sizes[2] !== layout.emailContentSize ||
      sizes[3] !== layout.chatSize
    ) {
      setLayout({
        sidebarSize: sizes[0],
        emailListSize: sizes[1],
        emailContentSize: sizes[2],
        chatSize: sizes[3]
      });
    }
  }, [layout, setLayout]);
  
  return {
    refs: {
      sidebarRef,
      emailListRef,
      emailContentRef,
      chatRef
    },
    sizes: {
      sidebarSize: layout.sidebarSize,
      emailListSize: layout.emailListSize,
      emailContentSize: layout.emailContentSize,
      chatSize: layout.chatSize
    },
    onResize
  }
} 