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
    <div onDoubleClick={handleDoubleClick} className="group relative h-full w-5 flex items-center justify-center cursor-col-resize select-none">
      {/* Animated divider */}
      <Separator
        orientation="vertical"
        className="absolute inset-0 mx-auto w-px bg-border/30 transition-all duration-300 ease-out group-hover:bg-border group-hover:w-[2px]"
      />
      {/* Invisible grab overlay */}
      <ResizableHandle
        withHandle={false}
        className="absolute inset-0 !h-full w-full opacity-0 hover:opacity-100 transition-opacity duration-300"
      />
      {/* Tooltip */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs bg-background px-1 py-0.5 rounded border pointer-events-none opacity-0 group-hover:opacity-90 transition-opacity duration-300 whitespace-nowrap select-none">
        Double-click to reset
      </div>
    </div>
  )
} 