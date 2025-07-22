"use client"

import { useState, useCallback, useRef } from "react"
import { ChatWindow } from "@/components/chat-window"
import { ChatInput } from "@/components/chat-input"
import { ErrorBanner } from "@/components/error-banner"

interface Message {
  id: string
  type: "user" | "bot" | "loading"
  content: string
  timestamp: Date
}

interface SessionData {
  id: string
  companyId: string
  externalUserId: string
  agentIds: string[]
  pluginIds: string[]
  contextMetadata: any[]
  title: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface StatusLog {
  stepQuery: string
  statusType: string
  statusMessage: string
  retrievedAgents: any[]
  executedAgents: Array<{
    agentId: string
    name: string
    identifier: string
    url: string
    method: string
    queryParams: any
    statusCode: number
  }>
  time: string
}

interface SSEEvent {
  sessionId: string
  messageId: string
  eventIndex: number
  eventType: "statusLog" | "fulfillment" | "metricsLog" | "error"
  status: string
  answer?: string
  currentStatusLog?: StatusLog
  publicMetrics?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    ragTimeSec: number
    fulfillmentTimeSec: number
    totalTimeSec: number
  }
  /* optional raw text in case JSON still fails */
  raw?: string
}

const API_KEY = "bIUoWPNpt9GfbP7PDd0EHcuPiZwCknZo"
const BASE_URL = "https://api.on-demand.io/chat/v1"
const PLUGIN_IDS = ["plugin-1712327325", "plugin-1713962163", "plugin-1718116202"]

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState<string>("")

  const abortControllerRef = useRef<AbortController | null>(null)
  const accumulatedAnswerRef = useRef<string>("")
  const currentBotMessageIdRef = useRef<string | null>(null)

  const createSession = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch(`${BASE_URL}/sessions`, {
        method: "POST",
        headers: {
          apikey: API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentIds: [],
          externalUserId: "1",
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "")
        throw new Error(`Failed to create session: ${response.status} ${response.statusText} ${errorBody}`)
      }

      const result = await response.json()

      if (!result.data?.id) {
        throw new Error("Invalid session response: missing session ID")
      }

      return result.data.id
    } catch (error) {
      console.error("Session creation error:", error)
      throw new Error(`Session creation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }, [])

  const processSSEChunk = useCallback((chunk: string): "DONE" | SSEEvent | null => {
    if (!chunk.trim()) return null

    // 🔚 Handle stream termination
    if (chunk.includes("[DONE]")) return "DONE"

    const lines = chunk.split("\n")
    const dataLine = lines.find((line) => line.startsWith("data:"))
    if (!dataLine) return null

    // Strip the leading "data:" and trim whitespace
    let payload = dataLine.replace(/^data:\s*/, "").trim()

    // Some server errors come wrapped like:  [ERROR]:{...}
    // Remove the "[ERROR]:" prefix (and similar) before JSON.parse.
    const errorPrefixes = ["[ERROR]:", "[error]:", "[INFO]:", "[info]:"]
    for (const prefix of errorPrefixes) {
      if (payload.startsWith(prefix)) {
        payload = payload.slice(prefix.length).trim()
        break
      }
    }

    try {
      return JSON.parse(payload) as SSEEvent
    } catch {
      // If JSON parsing STILL fails, surface a special error object
      return {
        eventType: "error",
        status: "failed",
        sessionId: "",
        messageId: "",
        eventIndex: -1,
        raw: payload,
      }
    }
  }, [])

  const updateLoadingMessage = useCallback((statusLog?: StatusLog) => {
    if (!statusLog) {
      setLoadingMessage("Interacting with AI to get your answer...")
      return
    }

    const { statusMessage, retrievedAgents, executedAgents } = statusLog

    if (executedAgents && executedAgents.length > 0) {
      const agentName = executedAgents[0].name
      setLoadingMessage(`Interacting with ${agentName} to get your answer...`)
    } else if (retrievedAgents && retrievedAgents.length > 0) {
      const agentName = retrievedAgents[0].name || "agent"
      setLoadingMessage(`Interacting with ${agentName} to get your answer...`)
    } else if (statusMessage) {
      setLoadingMessage(statusMessage)
    } else {
      setLoadingMessage("Interacting with AI to get your answer...")
    }
  }, [])

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim() || isLoading) return

      setError(null)
      setIsLoading(true)

      // Add user message
      const userMsgId = Date.now().toString()
      setMessages((prev) => [
        ...prev,
        {
          id: userMsgId,
          type: "user",
          content: userMessage.trim(),
          timestamp: new Date(),
        },
      ])

      try {
        // Create session if needed
        let currentSessionId = sessionId
        if (!currentSessionId) {
          currentSessionId = await createSession()
          setSessionId(currentSessionId)
        }

        // Add loading message
        const loadingMsgId = `loading-${Date.now()}`
        currentBotMessageIdRef.current = loadingMsgId
        setMessages((prev) => [
          ...prev,
          {
            id: loadingMsgId,
            type: "loading",
            content: "Interacting with AI to get your answer...",
            timestamp: new Date(),
          },
        ])

        // Reset accumulator
        accumulatedAnswerRef.current = ""

        // Create abort controller
        abortControllerRef.current = new AbortController()

        // Send query
        const response = await fetch(`${BASE_URL}/sessions/${currentSessionId}/query`, {
          method: "POST",
          headers: {
            apikey: API_KEY,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            endpointId: "predefined-claude-4-sonnet",
            query: userMessage.trim(),
            // The API expects either agentIds OR pluginIds – we’ll send plugins
            pluginIds: PLUGIN_IDS,
            responseMode: "stream", // ‹— was “streaming”, server returns 400
            reasoningMode: "deepturbo",
            modelConfigs: {
              fulfillmentPrompt: "",
              stopSequences: [], // must be an array, not undefined
              maxTokens: 4000,
              temperature: 0.7,
              presencePenalty: 0,
              topP: 1,
              frequencyPenalty: 0,
            },
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "")
          throw new Error(`Query failed: ${response.status} ${response.statusText}\n${errorBody}`)
        }

        if (!response.body) {
          throw new Error("No response body received")
        }

        // Process SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Split by double newlines to separate SSE events
          const chunks = buffer.split("\n\n")
          buffer = chunks.pop() || "" // Keep incomplete chunk in buffer

          for (const chunk of chunks) {
            if (!chunk.trim()) continue

            const result = processSSEChunk(chunk)

            if (result === "DONE") {
              // Stream completed
              if (accumulatedAnswerRef.current) {
                // Replace loading message with final answer
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === currentBotMessageIdRef.current
                      ? { ...msg, type: "bot" as const, content: accumulatedAnswerRef.current }
                      : msg,
                  ),
                )
              }
              return
            }

            if (result && typeof result === "object") {
              const event = result as SSEEvent

              if (event.eventType === "error") {
                // Remove spinner
                setMessages((prev) => prev.filter((m) => m.id !== currentBotMessageIdRef.current))
                // Display the error text from server (or raw payload)
                setError(
                  event.status || event.raw ? `Server error: ${event.status || event.raw}` : "Unknown server error",
                )
                // Stop further processing
                reader.cancel().catch(() => {})
                return
              }

              if (event.eventType === "statusLog" && event.currentStatusLog) {
                updateLoadingMessage(event.currentStatusLog)

                // Update loading message content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === currentBotMessageIdRef.current
                      ? { ...msg, content: loadingMessage || "Processing..." }
                      : msg,
                  ),
                )
              }

              if (event.eventType === "fulfillment" && event.answer) {
                // Accumulate the answer
                accumulatedAnswerRef.current += event.answer

                // Update the message with accumulated content
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === currentBotMessageIdRef.current
                      ? { ...msg, type: "bot" as const, content: accumulatedAnswerRef.current }
                      : msg,
                  ),
                )
              }
            }
          }
        }
      } catch (error) {
        console.error("Send message error:", error)

        if (error instanceof Error && error.name === "AbortError") {
          return // Request was aborted, don't show error
        }

        // Remove loading message and show error
        setMessages((prev) => prev.filter((msg) => msg.id !== currentBotMessageIdRef.current))

        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
        setError(`Failed to send message: ${errorMessage}`)

        // Reset session on certain errors
        if (errorMessage.includes("session") || errorMessage.includes("401") || errorMessage.includes("403")) {
          setSessionId(null)
        }
      } finally {
        setIsLoading(false)
        setLoadingMessage("")
        currentBotMessageIdRef.current = null
        abortControllerRef.current = null
      }
    },
    [sessionId, isLoading, createSession, processSSEChunk, updateLoadingMessage, loadingMessage],
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">On-Demand Chat</h1>
        {sessionId && <p className="text-sm text-gray-500 mt-1">Session: {sessionId.slice(0, 8)}...</p>}
      </header>

      {error && <ErrorBanner message={error} onClose={clearError} />}

      <div className="flex-1 flex flex-col min-h-0">
        <ChatWindow messages={messages} />
        <ChatInput onSendMessage={sendMessage} disabled={isLoading} onStop={stopGeneration} isLoading={isLoading} />
      </div>
    </div>
  )
}
