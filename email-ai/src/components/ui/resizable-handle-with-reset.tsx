"use client"

import { ResizableHandle } from "./resizable"
import { useCallback } from "react"
import { ImperativePanelHandle } from "react-resizable-panels"

interface ResizableHandleWithResetProps {
  leftPanelRef?: React.RefObject<ImperativePanelHandle | null>
  rightPanelRef?: React.RefObject<ImperativePanelHandle | null>
  defaultLeftSize?: number
  defaultRightSize?: number
  withHandle?: boolean
}

export function ResizableHandleWithReset({
  leftPanelRef,
  rightPanelRef,
  defaultLeftSize = 50,
  defaultRightSize = 50,
  withHandle = true
}: ResizableHandleWithResetProps) {
  const handleDoubleClick = useCallback(() => {
    if (leftPanelRef?.current) {
      leftPanelRef.current.resize(defaultLeftSize)
    }
    
    if (rightPanelRef?.current) {
      rightPanelRef.current.resize(defaultRightSize)
    }
  }, [leftPanelRef, rightPanelRef, defaultLeftSize, defaultRightSize])
  
  return (
    <div onDoubleClick={handleDoubleClick} className="group relative">
      <ResizableHandle withHandle={withHandle} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs bg-background px-1 py-0.5 rounded border pointer-events-none opacity-0 group-hover:opacity-80 transition-opacity whitespace-nowrap">
        Double-click to reset
      </div>
    </div>
  )
} 