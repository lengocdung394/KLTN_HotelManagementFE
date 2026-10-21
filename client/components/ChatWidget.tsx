import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  MessageCircle,
  Send,
  X,
  Loader2,
  Sparkles,
  Building2,
  BedDouble,
  CalendarDays,
  Users,
  ArrowRight,
  QrCode,
  ExternalLink,
  CheckCircle2,
  User as UserIcon,
  Tag,
  Maximize2,
  Minimize2,
  Clock,
  CalendarCheck,
  Mic,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useSendChatMessageMutation, useLazyGetChatHistoryQuery, type ChatMessage as ChatMessageType } from "@/services/chatApi";
import { useAppSelector } from "@/store/hooks";
import { emitStaffSendCustomerChat } from "@/lib/socket";

export interface CustomerLiveMessage {
  id: string | number;
  sender: "customer" | "staff";
  senderName: string;
  message: string;
  timestamp: string;
  branchName?: string;
}

export interface CustomerLiveSession {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  branchName?: string;
  hotelId?: number | string | null;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  messages: CustomerLiveMessage[];
}

interface Message {
  id: number;
  from: "bot" | "user";
  text: string;
  state?: any;
}

export interface RoomOptionItem {
  type: string;
  typeName?: string;
  price: number | string;
}

export interface BookingCardData {
  hotelName: string;
  hotelSlug: string;
  roomType?: string;
  roomTypeName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
  children?: number;
  rooms?: number;
  pricePerNight?: number;
  customerName?: string;
  customerPhone?: string;
  roomOptions?: RoomOptionItem[];
}

export interface PayOSPaymentData {
  orderId: string | number;
  checkoutUrl?: string;
  qrCodeUrl?: string;
  amount: number;
  hotelName?: string;
  roomName?: string;
  bookingId?: string;
}

export interface HotelReservationData {
  bookingId: string;
  orderId?: string | number;
  hotelName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  customerName: string;
  customerPhone: string;
  services?: string;
  promotion?: string;
  totalAmount: number;
  paymentMethod?: string;
}

function formatVnd(amount: number | string): string {
  const num = typeof amount === "number" ? amount : Number(String(amount).replace(/[^\d]/g, "")) || 0;
  return `${num.toLocaleString("vi-VN")} đ`;
}

function getSlugFromHotelName(name?: string): string {
  if (!name) return "sen-viet-an-nhon";
  const lower = name.toLowerCase();
  if (lower.includes("sài gòn") || lower.includes("sai gon") || lower.includes("hồ chí minh") || lower.includes("tphcm")) {
    return "sen-viet-sai-gon";
  }
  if (lower.includes("hà nội") || lower.includes("ha noi")) {
    return "sen-viet-ha-noi";
  }
  if (lower.includes("đà nẵng") || lower.includes("da nang")) {
    return "sen-viet-da-nang";
  }
  if (lower.includes("nha trang")) {
    return "sen-viet-nha-trang";
  }
  if (lower.includes("đà lạt") || lower.includes("da lat")) {
    return "sen-viet-da-lat";
  }
  if (lower.includes("gò công") || lower.includes("go cong")) {
    return "sen-viet-go-cong";
  }
  if (lower.includes("an nhơn") || lower.includes("an nhon")) {
    return "sen-viet-an-nhon";
  }
  return "sen-viet-an-nhon";
}

function normalizeRoomTypeName(type?: string): string {
  if (!type) return "Phòng Tiêu Chuẩn";
  const upper = type.toUpperCase();
  if (upper.includes("STANDARD")) return "Phòng Tiêu Chuẩn";
  if (upper.includes("DELUXE")) return "Phòng Cao Cấp";
  if (upper.includes("SUITE")) return "Phòng Thượng Hạng";
  if (upper.includes("FAMILY")) return "Phòng Gia Đình";
  return type;
}

function parsePriceNumber(val: any): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const numStr = String(val).replace(/[^\d]/g, "");
  return Number(numStr) || 0;
}

/** Tách JSON booking_card hoặc payos_payment nếu bot trả về để hiển thị card tương tác */
function parseBotMessage(rawText: string): {
  cleanText: string;
  bookingCard?: BookingCardData;
  payosPayment?: PayOSPaymentData;
  hotelReservation?: HotelReservationData;
} {
  let cleanText = rawText;
  let bookingCard: BookingCardData | undefined;
  let payosPayment: PayOSPaymentData | undefined;
  let hotelReservation: HotelReservationData | undefined;

  // 1. PayOS payment block
  const payosRegex = /```(?:json)?(?::payos_payment)?\s*(\{[\s\S]*?"(?:checkoutUrl|qrCodeUrl)"[\s\S]*?\})\s*```/;
  const payosMatch = cleanText.match(payosRegex);
  if (payosMatch) {
    try {
      payosPayment = JSON.parse(payosMatch[1]);
      cleanText = cleanText.replace(payosMatch[0], "").trim();
    } catch (e) {
      console.error("Failed to parse payos_payment", e);
    }
  }

  // 2. Booking card block
  const bookingRegex = /```(?:json)?(?::booking_card)?\s*(\{[\s\S]*?"(?:hotelName|hotel)"[\s\S]*?\})\s*```/;
  const bookingMatch = cleanText.match(bookingRegex);
  if (bookingMatch) {
    try {
      const parsed = JSON.parse(bookingMatch[1]);
      const hotelName = parsed.hotelName || parsed.hotel || "Sen Việt Luxury";
      const hotelSlug = parsed.hotelSlug || getSlugFromHotelName(hotelName);

      const checkInDate = parsed.checkInDate || parsed.checkIn || "";
      const checkOutDate = parsed.checkOutDate || parsed.checkOut || "";

      let primaryRoomType = parsed.roomType || "DELUXE";
      let primaryPrice = parsePriceNumber(parsed.pricePerNight || parsed.price || 1200000);

      const roomOptions: RoomOptionItem[] | undefined = Array.isArray(parsed.roomOptions)
        ? parsed.roomOptions.map((opt: any) => ({
            type: opt.type || opt.roomType || "STANDARD",
            typeName: opt.typeName || normalizeRoomTypeName(opt.type || opt.roomType),
            price: parsePriceNumber(opt.price || opt.pricePerNight),
          }))
        : undefined;

      bookingCard = {
        hotelName,
        hotelSlug,
        checkInDate,
        checkOutDate,
        roomType: primaryRoomType,
        roomTypeName: parsed.roomTypeName || normalizeRoomTypeName(primaryRoomType),
        adults: parsed.adults || 2,
        children: parsed.children || 0,
        rooms: typeof parsed.rooms === "number" ? parsed.rooms : 1,
        pricePerNight: primaryPrice,
        customerName: parsed.customerName || parsed.name || parsed.fullName || "",
        customerPhone: parsed.customerPhone || parsed.phone || "",
        roomOptions,
      };

      cleanText = cleanText.replace(bookingMatch[0], "").trim();
    } catch (e) {
      console.error("Failed to parse booking_card", e);
    }
  }

  // Cơ chế bảo vệ: Xóa bất kỳ khối code markdown kỹ thuật nào còn sót lại
  cleanText = cleanText.replace(/```(?:json)?(?::\w+)?[\s\S]*?```/g, "").trim();
  cleanText = cleanText.replace(/```[\s\S]*$/g, "").trim();

  return { cleanText, bookingCard, payosPayment, hotelReservation };
}

const CHAT_OPEN_EVENT = "senviet:open-admin-chat";

export function openAdminChatWidget() {
  window.dispatchEvent(new Event(CHAT_OPEN_EVENT));
}

function formatReply(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\s*[-•]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="my-1 space-y-0.5">$&</ul>')
    .replace(/\n/g, "<br/>");
}

/**
 * Phát chuông thông báo (Hospitality Chime) bằng Web Audio API
 * Tự tổng hợp 2 nốt nhạc du dương D5 -> A5 không phụ thuộc file .mp3 bên ngoài
 */
export function playHospitalityChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // Nốt thứ 1: D5 (587.33 Hz) - chuông ngân thanh nhẹ
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Nốt thứ 2: A5 (880.00 Hz) - nốt cao vui vẻ, kết thúc ấm áp
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn("Could not play notification chime:", e);
  }
}

function getUserStorageKey(email?: string | null, employeeId?: string | null): string {
  const raw =
    email ||
    employeeId ||
    (typeof window !== "undefined" ? localStorage.getItem("email") || localStorage.getItem("id") : null) ||
    "guest";
  return raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
}

function getStoredSessionId(sessionKey: string): string {
  try {
    const saved = localStorage.getItem(sessionKey);
    if (saved && saved.trim()) return saved.trim();
    const newId = crypto.randomUUID();
    localStorage.setItem(sessionKey, newId);
    return newId;
  } catch {
    return crypto.randomUUID();
  }
}

function getInitialCachedMessages(cacheKey: string, greeting: string): Message[] {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [{ id: 1, from: "bot", text: greeting }];
}

export default function ChatWidget() {
  const { t } = useTranslation();
  const defaultGreeting = t(
    "ai.widgetAdminGreeting",
    "Kính chào Quý Quản lý / Admin Sen Việt! 👋\nEm là Trợ lý AI Quản trị & Vận hành (Staff & Admin Copilot). Em sẵn sàng hỗ trợ Anh/Chị:\n• 🛎️ Tra cứu ca trực hôm nay & thời khóa biểu tuần\n• 🏨 Tra cứu phòng trống thời gian thực & phòng chờ dọn\n• 🔍 Tra cứu chi tiết booking, trạng thái thanh toán\n• 📊 Báo cáo doanh thu, công suất phòng & phân tích đánh giá khách\n• 📝 Hướng dẫn quy trình chuẩn SOP (hoàn tiền, check-in sớm, bồi thường)\n• ✍️ Soạn thảo nhanh email xin lỗi, phản hồi đánh giá 5 sao."
  );

  const auth = useAppSelector((state) => state.auth);
  const userKey = getUserStorageKey(auth?.email, auth?.employeeId);
  const sessionKey = `senviet_admin_copilot_session_${userKey}`;
  const cacheKey = `senviet_admin_copilot_messages_${userKey}`;

  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() =>
    getInitialCachedMessages(cacheKey, defaultGreeting)
  );
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>(getStoredSessionId(sessionKey));
  const historyRef = useRef<ChatMessageType[]>([]);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = "vi-VN";

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? prev + " " + transcript : transcript));
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const [sendChatMessage] = useSendChatMessageMutation();
  const [triggerGetHistory] = useLazyGetChatHistoryQuery();

  // Save messages to user-scoped local cache whenever messages state changes
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(messages));
      } catch {}
    }
  }, [messages, cacheKey]);

  const handleStartNewChat = useCallback(() => {
    const newId = crypto.randomUUID();
    try {
      localStorage.setItem(sessionKey, newId);
      localStorage.removeItem(cacheKey);
    } catch {}
    sessionIdRef.current = newId;
    historyRef.current = [];
    setMessages([{ id: Date.now(), from: "bot", text: defaultGreeting }]);
  }, [defaultGreeting, sessionKey, cacheKey]);

  // Restore history on component mount or when user switches account
  useEffect(() => {
    let isMounted = true;
    const curSession = getStoredSessionId(sessionKey);
    sessionIdRef.current = curSession;
    const initialMsgs = getInitialCachedMessages(cacheKey, defaultGreeting);
    setMessages(initialMsgs);
    historyRef.current = [];

    const fetchHistory = async () => {
      if (!curSession) return;
      try {
        const res: any = await triggerGetHistory(curSession);
        const serverMsgs = res.data?.result?.messages || res.result?.messages;
        if (isMounted && serverMsgs && serverMsgs.length > 0) {
          const restored: Message[] = serverMsgs.map((m: any, idx: number) => ({
            id: m.id || Date.now() + idx,
            from: m.role === "user" ? ("user" as const) : ("bot" as const),
            text: m.content,
            state: idx === serverMsgs.length - 1 ? (res.data?.result?.state || res.result?.state) : undefined,
          }));
          setMessages(restored);

          historyRef.current = serverMsgs
            .map((m: any) => ({
              role: m.role === "user" ? ("user" as const) : ("model" as const),
              content: m.content,
            }))
            .slice(-10);
        }
      } catch {
        // Fallback to local cached messages
      }
    };
    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [userKey, sessionKey, cacheKey, defaultGreeting, triggerGetHistory]);

  // Listen for external open events
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(CHAT_OPEN_EVENT, handler);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, handler);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, isTyping]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      const userMsg: Message = { id: Date.now(), from: "user", text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      historyRef.current = [
        ...historyRef.current,
        { role: "user" as const, content: text },
      ].slice(-10);

      try {
        const result = await sendChatMessage({
          message: text,
          sessionId: sessionIdRef.current,
          history: historyRef.current.slice(0, -1),
        });

        const reply = result.result?.reply || "Dạ em đã nhận được yêu cầu của Anh/Chị.";
        const state = result.result?.state;

        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, from: "bot", text: reply, state: state },
        ]);

        if (result.result?.sessionId) {
          sessionIdRef.current = result.result.sessionId;
          try {
            localStorage.setItem(sessionKey, result.result.sessionId);
          } catch {}
        }

        historyRef.current = [
          ...historyRef.current,
          { role: "model" as const, content: reply },
        ].slice(-10);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            from: "bot",
            text: "Xin lỗi Anh/Chị, dịch vụ AI đang tạm bận hoặc chưa khởi động ở cổng 8000. Vui lòng thử lại sau giây lát nhé! 🙏",
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping, sendChatMessage, sessionKey]
  );

  const quickReplies = [
    "🛎️ Hôm nay ai trực lễ tân Sài Gòn?",
    "🏨 Hôm nay CN Sài Gòn còn phòng trống không?",
    "📊 Báo cáo doanh thu & công suất phòng",
    "📋 Danh sách khách check-in & phòng chờ dọn",
    "🔍 Kiểm tra đặt phòng BKG_601",
    "⭐ Phân tích đánh giá của khách hàng",
    "📝 Quy trình xử lý khách đòi hoàn tiền (SOP)",
    "🤖 Xếp lịch ca trực tuần mới bằng AI",
  ];

  const [activeTab, setActiveTab] = useState<"ai" | "customer">("customer");
  const [customerSessions, setCustomerSessions] = useState<Record<string, CustomerLiveSession>>(() => {
    try {
      const saved = localStorage.getItem("senviet_staff_customer_sessions");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerReplyInput, setCustomerReplyInput] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const customerScrollRef = useRef<HTMLDivElement>(null);
  const processedMsgIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleCustomerMessage = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const payload = customEvent.detail;
      if (!payload || !payload.message) return;

      const cId = String(payload.customerId || "guest");
      const cName = payload.customerName || "Khách hàng";
      const cPhone = payload.customerPhone || "";
      const bName = payload.branchName || "Chi nhánh Sen Việt";
      const hId = payload.hotelId;
      const msg = payload.message;
      const time = payload.timestamp || new Date().toISOString();

      const msgId = String(payload.msgId || `${cId}_${time}_${msg}`);

      // Chống lặp thông báo nếu đã xử lý msgId này
      if (processedMsgIdsRef.current.has(msgId)) {
        return;
      }
      processedMsgIdsRef.current.add(msgId);
      if (processedMsgIdsRef.current.size > 200) {
        const first = processedMsgIdsRef.current.values().next().value;
        if (first) processedMsgIdsRef.current.delete(first);
      }

      setCustomerSessions((prev) => {
        const existing = prev[cId] || {
          customerId: cId,
          customerName: cName,
          customerPhone: cPhone,
          branchName: bName,
          hotelId: hId,
          lastMessage: "",
          lastTimestamp: time,
          unreadCount: 0,
          messages: [],
        };

        // KIỂM TRA TRÙNG LẶP TIN NHẮN TỪ KHÁCH HÀNG (DEDUPLICATION)
        const isDuplicate = existing.messages.some((m) => {
          if (payload.msgId && String(m.id) === String(payload.msgId)) return true;
          return m.sender === "customer" && m.message === msg && Math.abs(new Date(m.timestamp).getTime() - new Date(time).getTime()) < 3000;
        });

        if (isDuplicate) {
          console.log("⚠️ [Socket Staff] Bỏ qua tin nhắn trùng lặp từ khách:", msg);
          return prev;
        }

        const newMsg: CustomerLiveMessage = {
          id: msgId,
          sender: "customer",
          senderName: cName,
          message: msg,
          timestamp: time,
          branchName: bName,
        };

        const isCurrentActive = activeTab === "customer" && selectedCustomerId === cId && open;
        const updatedSessions = {
          ...prev,
          [cId]: {
            ...existing,
            customerName: cName || existing.customerName,
            customerPhone: cPhone || existing.customerPhone,
            branchName: bName || existing.branchName,
            lastMessage: msg,
            lastTimestamp: time,
            unreadCount: isCurrentActive ? 0 : (existing.unreadCount || 0) + 1,
            messages: [...existing.messages, newMsg],
          },
        };

        try {
          localStorage.setItem("senviet_staff_customer_sessions", JSON.stringify(updatedSessions));
        } catch {}

        if (!isCurrentActive) {
          setUnreadTotal((u) => u + 1);
        }

        return updatedSessions;
      });

      setSelectedCustomerId((curr) => curr || cId);

      // 🔔 1. Phát chuông thông báo (Hospitality Chime) âm thanh trong trẻo
      playHospitalityChime();

      // 🔔 2. Hiển thị Toast thông báo nổi trên màn hình nhân viên nếu chưa đang mở đúng cuộc trò chuyện
      const isCurrentActive = activeTab === "customer" && selectedCustomerId === cId && open;
      if (!isCurrentActive) {
        toast({
          title: `💬 Khách hàng nhắn tin: ${cName}`,
          description: `${bName ? `[${bName}] ` : ""}${msg.length > 70 ? msg.substring(0, 70) + "..." : msg}`,
          variant: "booking",
          action: (
            <ToastAction
              altText="Xem và trả lời"
              className="bg-indigo-600 text-white hover:bg-indigo-700 border-none font-medium text-xs px-2.5 py-1 h-auto"
              onClick={() => {
                setOpen(true);
                setActiveTab("customer");
                setSelectedCustomerId(cId);
              }}
            >
              Trả lời
            </ToastAction>
          ),
        });
      }
    };

    const handleStaffReplyBroadcast = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const payload = customEvent.detail;
      if (!payload || !payload.message) return;
      const cId = String(payload.customerId || "");
      if (!cId) return;

      setCustomerSessions((prev) => {
        const session = prev[cId];
        if (!session) return prev;
        const exists = session.messages.some((m) => {
          if (payload.msgId && String(m.id) === String(payload.msgId)) return true;
          return m.sender === "staff" && m.message === payload.message;
        });
        if (exists) return prev;

        const newMsg: CustomerLiveMessage = {
          id: payload.msgId || (Date.now() + Math.random()),
          sender: "staff",
          senderName: payload.staffName || "Lễ tân",
          message: payload.message,
          timestamp: payload.timestamp || new Date().toISOString(),
          branchName: payload.branchName,
        };

        const updated = {
          ...prev,
          [cId]: {
            ...session,
            lastMessage: payload.message,
            lastTimestamp: payload.timestamp || new Date().toISOString(),
            messages: [...session.messages, newMsg],
          },
        };
        try {
          localStorage.setItem("senviet_staff_customer_sessions", JSON.stringify(updated));
        } catch {}
        return updated;
      });
    };

    window.addEventListener("customer_staff_chat_message", handleCustomerMessage);
    window.addEventListener("staff_customer_chat_reply", handleStaffReplyBroadcast);
    return () => {
      window.removeEventListener("customer_staff_chat_message", handleCustomerMessage);
      window.removeEventListener("staff_customer_chat_reply", handleStaffReplyBroadcast);
    };
  }, [activeTab, selectedCustomerId, open]);

  // Tự động tải tất cả phiên chat và lịch sử từ PostgreSQL vào giao diện Nhân viên
  useEffect(() => {
    const fetchSessionsFromDb = async () => {
      try {
        const hotelQuery = auth?.hotelId ? `?hotelId=${auth.hotelId}` : "";
        const res = await fetch(`/live-chat/sessions${hotelQuery}`);
        if (!res.ok) return;
        const data = await res.json();
        const serverSessions = data.result;
        if (Array.isArray(serverSessions) && serverSessions.length > 0) {
          setCustomerSessions((prev) => {
            const merged = { ...prev };
            serverSessions.forEach((s: any) => {
              const cId = s.customerId;
              const msgs: CustomerLiveMessage[] = (s.messages || []).map((m: any) => ({
                id: m.id || m.msgId,
                sender: m.senderType === "CUSTOMER" ? "customer" : "staff",
                senderName: m.senderName,
                message: m.message,
                timestamp: m.createdAt,
                branchName: s.branchName,
              }));

              if (!merged[cId]) {
                merged[cId] = {
                  customerId: cId,
                  customerName: s.customerName || "Khách hàng",
                  customerPhone: s.customerPhone || "",
                  branchName: s.branchName || "Chi nhánh Sen Việt",
                  hotelId: s.hotelId,
                  lastMessage: s.lastMessage || "",
                  lastTimestamp: s.lastMessageAt || s.createdAt,
                  unreadCount: 0,
                  messages: msgs,
                };
              } else {
                const existingMsgIds = new Set(merged[cId].messages.map((m) => String(m.id)));
                msgs.forEach((m) => {
                  if (!existingMsgIds.has(String(m.id))) {
                    merged[cId].messages.push(m);
                  }
                });
                merged[cId].customerName = s.customerName || merged[cId].customerName;
                merged[cId].customerPhone = s.customerPhone || merged[cId].customerPhone;
              }
            });
            return merged;
          });
        }
      } catch (err) {
        console.warn("Could not load sessions from DB:", err);
      }
    };
    fetchSessionsFromDb();
  }, [auth?.hotelId]);

  useEffect(() => {
    const keys = Object.keys(customerSessions);
    if (!selectedCustomerId && keys.length > 0) {
      setSelectedCustomerId(keys[0]);
    }
  }, [customerSessions, selectedCustomerId]);

  useEffect(() => {
    if (activeTab === "customer") {
      customerScrollRef.current?.scrollTo({
        top: customerScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [customerSessions, activeTab, selectedCustomerId]);

  const handleSendStaffReply = () => {
    const trimmed = customerReplyInput.trim();
    if (!trimmed || !selectedCustomerId) return;

    const currentSession = customerSessions[selectedCustomerId];
    const staffName = auth?.fullName || "Trần Minh Tuấn (Lễ tân)";
    const staffId = auth?.employeeId ? String(auth.employeeId) : "staff_1";
    const hotelId = auth?.hotelId || currentSession?.hotelId || null;
    const branchName = auth?.hotelName || currentSession?.branchName || "Chi nhánh Sen Việt";
    const timestamp = new Date().toISOString();
    const msgId = "staff_msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);

    const payload = {
      msgId,
      customerId: selectedCustomerId,
      staffId,
      staffName,
      hotelId,
      branchName,
      message: trimmed,
      timestamp,
    };

    emitStaffSendCustomerChat(payload);

    const newMsg: CustomerLiveMessage = {
      id: msgId,
      sender: "staff",
      senderName: staffName,
      message: trimmed,
      timestamp,
      branchName,
    };

    setCustomerSessions((prev) => {
      const session = prev[selectedCustomerId] || {
        customerId: selectedCustomerId,
        customerName: "Khách hàng",
        messages: [],
        lastMessage: "",
        lastTimestamp: "",
        unreadCount: 0,
      };
      const updated = {
        ...prev,
        [selectedCustomerId]: {
          ...session,
          lastMessage: trimmed,
          lastTimestamp: timestamp,
          unreadCount: 0,
          messages: [...session.messages, newMsg],
        },
      };
      try {
        localStorage.setItem("senviet_staff_customer_sessions", JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setCustomerReplyInput("");
  };

  const selectedSession = selectedCustomerId ? customerSessions[selectedCustomerId] : null;

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unreadTotal > 0) {
            setActiveTab("customer");
            setUnreadTotal(0);
          }
        }}
        aria-label="Staff Assistant & Customer Chat"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-600/30 transition-all duration-200 hover:scale-105 hover:from-blue-700 hover:to-indigo-700 active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unreadTotal > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shadow border-2 border-white animate-bounce">
            {unreadTotal}
          </span>
        ) : !open ? (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 border-2 border-white"></span>
          </span>
        ) : null}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 ease-in-out ${
            isExpanded
              ? "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[48rem] md:w-[56rem] h-[92vh] max-h-[58rem]"
              : "bottom-24 right-6 w-[26rem] max-w-[calc(100vw-2rem)] sm:w-[28rem] h-[36rem] max-h-[82vh]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 text-white shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm border border-white/20">
                {activeTab === "ai" ? <Bot className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
              </span>
              <div>
                <div className="text-base font-semibold leading-tight flex items-center gap-2">
                  <span>{activeTab === "ai" ? "Trợ lý AI Quản trị" : "Tư vấn Khách hàng (Live)"}</span>
                  <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
                    {auth?.hotelName || "Chi nhánh Sen Việt"}
                  </span>
                </div>
                <div className="text-[11px] text-blue-100/80">
                  {activeTab === "ai" ? "Điều hành chuỗi khách sạn · Google Gemini RAG" : "Kênh chat trực tuyến 2 chiều qua Socket.IO"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeTab === "ai" && (
                <button
                  onClick={handleStartNewChat}
                  className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                  title="Bắt đầu cuộc trò chuyện mới"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsExpanded((prev) => !prev)}
                className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                title={isExpanded ? "Thu nhỏ" : "Phóng to cửa sổ"}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white"
                title="Đóng chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Sub-header Tabs: AI Copilot vs Khách hàng Live Chat */}
          <div className="flex border-b border-slate-200 bg-slate-100/90 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition ${
                activeTab === "ai"
                  ? "border-b-2 border-blue-600 bg-white font-semibold text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Bot className="h-4 w-4" />
              <span>Trợ lý AI Quản trị</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("customer");
                setUnreadTotal(0);
                if (selectedCustomerId && customerSessions[selectedCustomerId]) {
                  setCustomerSessions((prev) => ({
                    ...prev,
                    [selectedCustomerId]: { ...prev[selectedCustomerId], unreadCount: 0 },
                  }));
                }
              }}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 transition ${
                activeTab === "customer"
                  ? "border-b-2 border-indigo-600 bg-white font-semibold text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              <span>Khách hàng Chat (Live)</span>
              {unreadTotal > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white animate-pulse">
                  {unreadTotal}
                </span>
              )}
            </button>
          </div>

          {activeTab === "ai" && (
            <>

          {/* Messages area */}
          <div
            ref={scrollRef}
            className={`flex-1 space-y-3.5 overflow-y-auto leading-relaxed bg-slate-50/50 ${
              isExpanded ? "px-6 py-5 text-[15px]" : "px-4 py-3.5 text-[14px]"
            }`}
          >
            {messages.map((m) => {
              if (m.from === "user") {
                return (
                  <div
                    key={m.id}
                    className={`ml-auto rounded-2xl bg-blue-600 px-4 py-2.5 text-white shadow-sm ${
                      isExpanded ? "max-w-[70%]" : "max-w-[85%]"
                    }`}
                  >
                    {m.text}
                  </div>
                );
              }

              const { cleanText, bookingCard, payosPayment } = parseBotMessage(m.text);

              return (
                <div key={m.id} className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 mt-0.5">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div
                      className={`rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-slate-800 shadow-sm ${
                        isExpanded ? "max-w-[75%]" : "max-w-[88%]"
                      }`}
                      dangerouslySetInnerHTML={{ __html: formatReply(cleanText) }}
                    />
                  </div>

                  {/* Interactive Booking Card Preview */}
                  {bookingCard && (
                    <div className="ml-9 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-md">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          <span className="font-semibold text-slate-800 text-sm">{bookingCard.hotelName}</span>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                          {bookingCard.roomTypeName || bookingCard.roomType}
                        </span>
                      </div>

                      <div className="p-4 space-y-2.5 text-xs text-slate-600">
                        <div className="grid grid-cols-2 gap-2">
                          {bookingCard.checkInDate && (
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                              <span>Nhận: {bookingCard.checkInDate}</span>
                            </div>
                          )}
                          {bookingCard.checkOutDate && (
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                              <span>Trả: {bookingCard.checkOutDate}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              {bookingCard.adults} người lớn
                              {bookingCard.children ? `, ${bookingCard.children} trẻ em` : ""}
                            </span>
                          </div>
                          {bookingCard.pricePerNight ? (
                            <div className="flex items-center gap-1.5 font-bold text-blue-600">
                              <Tag className="h-3.5 w-3.5" />
                              <span>{formatVnd(bookingCard.pricePerNight)}/đêm</span>
                            </div>
                          ) : null}
                        </div>

                        {bookingCard.customerName && (
                          <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-slate-700">
                            <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>Khách: {bookingCard.customerName} {bookingCard.customerPhone ? `(${bookingCard.customerPhone})` : ""}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                        <Link
                          to="/bookings"
                          onClick={() => setOpen(false)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                        >
                          <span>Mở Quản lý Đặt phòng</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* PayOS Payment Card Preview */}
                  {payosPayment && (
                    <div className="ml-9 overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-md p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <QrCode className="h-5 w-5 text-emerald-600" />
                          <span className="font-semibold text-sm text-slate-800">Thanh toán PayOS VietQR</span>
                        </div>
                        <span className="font-bold text-emerald-600 text-sm">{formatVnd(payosPayment.amount)}</span>
                      </div>

                      {payosPayment.qrCodeUrl && (
                        <div className="flex justify-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                          <img src={payosPayment.qrCodeUrl} alt="VietQR" className="h-44 w-44 object-contain" />
                        </div>
                      )}

                      {payosPayment.checkoutUrl && (
                        <a
                          href={payosPayment.checkoutUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          <span>Mở trang thanh toán PayOS</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-slate-400 text-xs pl-9">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span>Trợ lý AI đang tra cứu dữ liệu & soạn câu trả lời...</span>
              </div>
            )}
          </div>

          {/* Quick reply suggestions */}
          <div className="border-t border-slate-100 bg-white px-3 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <span className="text-[11px] font-medium text-slate-400 shrink-0">Gợi ý:</span>
              {quickReplies.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => send(q)}
                  disabled={isTyping}
                  className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi ca trực, ai làm hôm nay, đơn nghỉ phép, xếp ca tuần..."
              disabled={isTyping}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50"
            />

            {recognitionRef.current && (
              <button
                type="button"
                onClick={toggleListening}
                className={`rounded-xl p-2 transition ${
                  isListening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                title="Nhập bằng giọng nói"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40"
              title="Gửi tin nhắn"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </>
      )}

      {/* TAB 2: KHÁCH HÀNG LIVE CHAT */}
      {activeTab === "customer" && (
        <>
          {/* Header bar with active customer selector */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs">
            <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
              <span className="shrink-0 font-medium text-slate-500">Khách chat:</span>
              {Object.keys(customerSessions).length > 0 ? (
                <select
                  value={selectedCustomerId || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedCustomerId(id);
                    if (id && customerSessions[id]) {
                      setCustomerSessions((prev) => ({
                        ...prev,
                        [id]: { ...prev[id], unreadCount: 0 },
                      }));
                    }
                  }}
                  className="truncate flex-1 max-w-[280px] rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500"
                >
                  {Object.values(customerSessions).map((s) => (
                    <option key={s.customerId} value={s.customerId}>
                      👤 {s.customerName} {s.customerPhone ? `(${s.customerPhone})` : ""} - {s.branchName}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="italic text-slate-400">Chưa có khách hàng kết nối</span>
              )}
            </div>
            {selectedSession && (
              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {selectedSession.branchName || "Chi nhánh"}
              </span>
            )}
          </div>

          {/* Customer chat messages area */}
          <div
            ref={customerScrollRef}
            className={`flex-1 space-y-3.5 overflow-y-auto leading-relaxed bg-slate-50/50 ${
              isExpanded ? "px-6 py-5 text-[15px]" : "px-4 py-3.5 text-[14px]"
            }`}
          >
            {!selectedSession || selectedSession.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 mb-3">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Đang chờ tin nhắn từ khách hàng</p>
                <p className="mt-1 text-xs text-slate-400 max-w-xs">
                  Khi khách hàng gửi tin nhắn từ cửa sổ chat tại website khách hàng, tin nhắn sẽ kết nối trực tiếp đến màn hình này theo thời gian thực (Socket.IO).
                </p>
              </div>
            ) : (
              selectedSession.messages.map((m) => {
                if (m.sender === "staff") {
                  return (
                    <div key={m.id} className="space-y-1">
                      <div className="text-right text-[11px] text-slate-400 font-medium">
                        {m.senderName} (Bạn) · {new Date(m.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div
                        className={`ml-auto rounded-2xl bg-indigo-600 px-4 py-2.5 text-white shadow-sm ${
                          isExpanded ? "max-w-[70%]" : "max-w-[85%]"
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="space-y-1">
                    <div className="text-left text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                      <span className="font-semibold text-indigo-700">{m.senderName}</span>
                      <span>·</span>
                      <span className="text-slate-400">{new Date(m.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div
                      className={`mr-auto rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 shadow-sm ${
                        isExpanded ? "max-w-[70%]" : "max-w-[85%]"
                      }`}
                    >
                      {m.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Staff quick replies */}
          <div className="border-t border-slate-100 bg-white px-3 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              <span className="text-[11px] font-medium text-slate-400 shrink-0">Trả lời nhanh:</span>
              {[
                "Dạ Sen Việt xin chào quý khách!",
                "Dạ em đã kiểm tra thông tin trên hệ thống ạ.",
                "Quý khách cho em xin Mã đặt phòng hoặc SĐT nhé ạ!",
                "Dạ bộ phận Lễ tân đã ghi nhận yêu cầu của anh/chị ạ.",
              ].map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setCustomerReplyInput(q)}
                  className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Staff input form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendStaffReply();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={customerReplyInput}
              onChange={(e) => setCustomerReplyInput(e.target.value)}
              placeholder={
                selectedCustomerId
                  ? `Nhập tin nhắn trả lời khách hàng (${customerSessions[selectedCustomerId]?.customerName || "Khách"})...`
                  : "Chưa có khách hàng để trả lời..."
              }
              disabled={!selectedCustomerId}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
            />
            <button
              type="submit"
              disabled={!customerReplyInput.trim() || !selectedCustomerId}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-40"
              title="Gửi câu trả lời cho khách hàng"
            >
              <span>Gửi</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </>
      )}
    </div>
  )}
    </>
  );
}
