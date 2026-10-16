import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "model";
  content: string;
  state?: any;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  history: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  sessionId: string;
  state?: any;
  ragMetrics?: any;
}

export interface ChatHistoryItem {
  id: number;
  role: "user" | "model";
  content: string;
  metadata?: any;
  createdAt?: string;
}

export interface ChatHistoryResponse {
  sessionId: string;
  session?: any;
  state?: any;
  messages: ChatHistoryItem[];
}

const AI_BASE_URL = "http://127.0.0.1:8000";

export async function sendChatMessageApi(req: ChatRequest): Promise<{ code: number; message: string; result: ChatResponse }> {
  const urls = [`${AI_BASE_URL}/admin-ai/chat`, `/api/admin-ai/chat`, `${AI_BASE_URL}/api/admin-ai/chat`];
  let lastError: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Failed to send chat message to Admin AI service");
}

export async function getChatHistoryApi(sessionId: string): Promise<{ code: number; message: string; result: ChatHistoryResponse }> {
  const urls = [`${AI_BASE_URL}/admin-ai/chat/history/${sessionId}`, `/api/admin-ai/chat/history/${sessionId}`, `${AI_BASE_URL}/api/admin-ai/chat/history/${sessionId}`];
  let lastError: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Failed to get chat history from Admin AI service");
}

export async function deleteChatHistoryApi(sessionId: string): Promise<{ code: number; message: string; result: any }> {
  const urls = [`${AI_BASE_URL}/admin-ai/chat/history/${sessionId}`, `/api/admin-ai/chat/history/${sessionId}`, `${AI_BASE_URL}/api/admin-ai/chat/history/${sessionId}`];
  let lastError: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Failed to delete chat history");
}

export function useSendChatMessageMutation() {
  const [isLoading, setIsLoading] = useState(false);
  const mutateAsync = useCallback(async (body: ChatRequest) => {
    setIsLoading(true);
    try {
      return await sendChatMessageApi(body);
    } finally {
      setIsLoading(false);
    }
  }, []);
  return [mutateAsync, { isLoading }] as const;
}

export function useLazyGetChatHistoryQuery() {
  const [isLoading, setIsLoading] = useState(false);
  const trigger = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      return await getChatHistoryApi(sessionId);
    } finally {
      setIsLoading(false);
    }
  }, []);
  return [trigger, { isLoading }] as const;
}
