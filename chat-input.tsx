"use client"

import type React from "react"

import { useState, useRef, type KeyboardEvent } from "react"
import { Send, Square } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  onStop?: () => void
  isLoading?: boolean
}

export function ChatInput({ onSendMessage, disabled = false, onStop, isLoading = false }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message)
      setMessage("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)

    // Auto-resize textarea
    const textarea = e.target
    textarea.style.height = "auto"
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px"
  }

  const handleStop = () => {
    if (onStop) {
      onStop()
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-end space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={
                disabled ? "Processing..." : "Type your message... (Press Enter to send, Shift+Enter for new line)"
              }
              disabled={disabled}
              className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 min-h-[48px] max-h-[120px]"
              rows={1}
            />
          </div>

          {isLoading ? (
            <Button onClick={handleStop} variant="outline" size="sm" className="flex-shrink-0 h-12 px-4 bg-transparent">
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={disabled || !message.trim()}
              size="sm"
              className="flex-shrink-0 h-12 px-4"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-500 text-center">
          AI responses are generated using On-Demand.io agents and may contain errors.
        </div>
      </div>
    </div>
  )
}
