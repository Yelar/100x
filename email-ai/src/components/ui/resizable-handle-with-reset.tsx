"use client"

import { ResizableHandle } from "./resizable"
import { Separator } from "@/components/ui/separator"
import { useCallback } from "react"
import { ImperativePanelHandle } from "react-resizable-panels"

interface ResizableHandleWithResetProps {
  leftPanelRef?: React.RefObject<ImperativePanelHandle | null>
  rightPanelRef?: React.RefObject<ImperativePanelHandle | null>
  defaultLeftSize?: number
  defaultRightSize?: number
  // keeping prop for API compatibility but not used
  withHandle?: boolean
}

export function ResizableHandleWithReset({
  leftPanelRef,
  rightPanelRef,
  defaultLeftSize = 50,
  defaultRightSize = 50
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
    <div onDoubleClick={handleDoubleClick} className="relative h-full w-px cursor-col-resize select-none">
      {/* Always invisible divider */}
      <Separator
        orientation="vertical"
        className="absolute inset-0 mx-auto w-px bg-border/30"
      />
      {/* Invisible grab overlay */}
      <ResizableHandle
        withHandle={false}
        className="absolute inset-0 !h-full w-2 -ml-0.5 opacity-0"
      />
    </div>
  )
} 