"use client"

import { useEffect, useRef } from "react"
import { Bot, User, Loader2 } from "lucide-react"

interface Message {
  id: string
  type: "user" | "bot" | "loading"
  content: string
  timestamp: Date
}

interface ChatWindowProps {
  messages: Message[]
}

export function ChatWindow({ messages }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Welcome to On-Demand Chat</h2>
          <p className="text-gray-500 max-w-md">
            Start a conversation by typing a message below. I can help you with various tasks using AI agents.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start space-x-3 ${message.type === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.type === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
            }`}
          >
            {message.type === "user" ? (
              <User className="w-4 h-4" />
            ) : message.type === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>

          <div className={`flex-1 max-w-3xl ${message.type === "user" ? "text-right" : ""}`}>
            <div
              className={`inline-block p-3 rounded-lg ${
                message.type === "user"
                  ? "bg-blue-500 text-white"
                  : message.type === "loading"
                    ? "bg-yellow-50 text-yellow-800 border border-yellow-200"
                    : "bg-white text-gray-900 border border-gray-200"
              }`}
            >
              {message.type === "loading" ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{message.content}</span>
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words">{message.content}</div>
              )}
            </div>

            <div className={`text-xs text-gray-500 mt-1 ${message.type === "user" ? "text-right" : ""}`}>
              {formatTime(message.timestamp)}
            </div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
