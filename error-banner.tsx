"use client"

import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBannerProps {
  message: string
  onClose: () => void
}

export function ErrorBanner({ message, onClose }: ErrorBannerProps) {
  return (
    <div className="bg-red-50 border-l-4 border-red-400 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <p className="text-sm text-red-700 mt-1">{message}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-red-400 hover:text-red-600 hover:bg-red-100"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
