import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Database,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const AI_BASE_URL =
  import.meta.env.VITE_AI_API_URL ||
  import.meta.env.VITE_AI_BASE_URL ||
  "http://localhost:8000";

type BotSettings = {
  bot_name: string;
  brand_intro: string;
  persona_prompt: string;
  questioning_mode: "step_by_step" | "express";
  questioning_strategy_prompt: string;
  recommendation_prompt: string;
  max_recommendations: number;
  temperature: number;
  updated_at?: string | null;
};

type PlaygroundMsg = {
  id: number;
  role: "user" | "model";
  content: string;
  chips?: string[];
};

type RagChunk = {
  text: string;
  score: number;
  metadata: Record<string, unknown>;
};

type AnalyticsData = {
  totalConsultations: number;
  bookingClicks: number;
  conversionRate: number;
  topNeeds: { label: string; count: number }[];
  topRoomTypes: { roomType: string; count: number }[];
};

type AiCmsPageProps = {
  onLogout?: () => void;
  homePath?: string;
};

export default function AiCmsPage({ homePath = "/overview" }: AiCmsPageProps) {
  const [activeTab, setActiveTab] = useState<"config" | "rag" | "analytics">("config");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BotSettings>({
    bot_name: "Trợ lý AI Sen Việt",
    brand_intro: "Chuỗi khách sạn Sen Việt Luxury",
    persona_prompt: "",
    questioning_mode: "step_by_step",
    questioning_strategy_prompt: "",
    recommendation_prompt: "",
    max_recommendations: 3,
    temperature: 0.3,
  });

  // Live Playground state
  const [playgroundSessionId, setPlaygroundSessionId] = useState(
    () => `playground-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundBusy, setPlaygroundBusy] = useState(false);
  const [playgroundMsgs, setPlaygroundMsgs] = useState<PlaygroundMsg[]>([
    {
      id: 1,
      role: "model",
      content:
        "Xin chào Admin! Đây là Live Playground — hãy nhắn thử như một khách hàng để kiểm tra phong cách tư vấn & Quick-Choice Chips ngay lập tức.",
      chips: ["Tư vấn phòng đi nghỉ dưỡng", "Tìm phòng gia đình ở Đà Nẵng", "Công tác cần yên tĩnh"],
    },
  ]);

  // RAG test search state
  const [ragQuery, setRagQuery] = useState("");
  const [ragBusy, setRagBusy] = useState(false);
  const [ragChunks, setRagChunks] = useState<RagChunk[]>([]);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsBusy, setAnalyticsBusy] = useState(false);

  useEffect(() => {
    fetch(`${AI_BASE_URL}/api/admin/bot-settings`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.result) setSettings(res.result);
      })
      .catch(() => {
        toast({
          title: "Không tải được cấu hình AI",
          description: "Vui lòng kiểm tra AI Service (cổng 8000).",
          variant: "destructive",
        });
      })
      .finally(() => setLoadingSettings(false));
  }, []);

  const loadAnalytics = async () => {
    setAnalyticsBusy(true);
    try {
      const r = await fetch(`${AI_BASE_URL}/api/admin/analytics`);
      const res = await r.json();
      if (res?.result) setAnalytics(res.result);
    } catch {
      toast({ title: "Lỗi tải thống kê AI", variant: "destructive" });
    } finally {
      setAnalyticsBusy(false);
    }
  };

  useEffect(() => {
    if (activeTab === "analytics") {
      void loadAnalytics();
    }
  }, [activeTab]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch(`${AI_BASE_URL}/api/admin/bot-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const res = await r.json();
      if (res?.result) {
        setSettings(res.result);
        toast({
          title: "Đã lưu cấu hình Trợ lý AI",
          description: "Cấu hình mới đã được áp dụng ngay vào hệ thống tư vấn.",
        });
      }
    } catch {
      toast({ title: "Lưu thất bại", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendPlayground = async (textOverride?: string) => {
    const msg = (textOverride ?? playgroundInput).trim();
    if (!msg || playgroundBusy) return;
    if (!textOverride) setPlaygroundInput("");

    const userEntry: PlaygroundMsg = { id: Date.now(), role: "user", content: msg };
    const nextHistory = [...playgroundMsgs, userEntry].slice(-12);
    setPlaygroundMsgs(nextHistory);
    setPlaygroundBusy(true);

    try {
      const r = await fetch(`${AI_BASE_URL}/api/admin/playground`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          sessionId: playgroundSessionId,
          history: nextHistory.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          userLanguage: "vi",
        }),
      });
      const res = await r.json();
      const reply = res?.result?.reply || "Không có phản hồi từ AI.";
      const chips = Array.isArray(res?.result?.quickReplies) ? res.result.quickReplies : [];
      setPlaygroundMsgs((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "model", content: reply, chips },
      ]);
    } catch {
      toast({ title: "Lỗi Playground", description: "Không gọi được /api/admin/playground.", variant: "destructive" });
    } finally {
      setPlaygroundBusy(false);
    }
  };

  const resetPlayground = () => {
    setPlaygroundSessionId(`playground-${Math.random().toString(36).slice(2, 10)}`);
    setPlaygroundMsgs([
      {
        id: Date.now(),
        role: "model",
        content: "Phiên Playground mới đã sẵn sàng. Hãy nhập câu hỏi test bên dưới!",
        chips: ["Tư vấn phòng đi nghỉ dưỡng", "Tìm phòng gia đình ở Đà Nẵng", "Công tác cần yên tĩnh"],
      },
    ]);
  };

  const runRagSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragQuery.trim()) return;
    setRagBusy(true);
    try {
      const r = await fetch(`${AI_BASE_URL}/api/admin/knowledge/test-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ragQuery.trim(), top_k: 6 }),
      });
      const res = await r.json();
      setRagChunks(Array.isArray(res?.result) ? res.result : []);
    } catch {
      toast({ title: "Lỗi truy vấn RAG", variant: "destructive" });
    } finally {
      setRagBusy(false);
    }
  };

  const lastModelChips =
    [...playgroundMsgs].reverse().find((m) => m.role === "model" && m.chips && m.chips.length > 0)?.chips || [];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              to={homePath}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-100"
              title="Quay lại"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Bot className="h-5 w-5 text-blue-600" />
                Cấu hình Trợ lý AI & Live Playground
              </h1>
              <p className="text-xs text-slate-500">
                Chỉnh chiến lược tư vấn 3 bước, chế độ hỏi (Step-by-step / Express), test RAG và xem thống kê chuyển đổi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("config")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === "config"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Persona & Playground
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rag")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === "rag"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Test RAG Knowledge
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("analytics")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                activeTab === "analytics"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Thống kê tư vấn
            </button>
          </div>
        </div>

        {/* Tab 1: Config + Live Playground */}
        {activeTab === "config" && (
          <div className="grid gap-5 lg:grid-cols-12">
            <form
              onSubmit={handleSaveSettings}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900">Thiết lập chiến lược tư vấn AI</h2>
                {settings.updated_at && (
                  <span className="text-[11px] text-slate-400">
                    Cập nhật: {new Date(settings.updated_at).toLocaleString("vi-VN")}
                  </span>
                )}
              </div>

              {loadingSettings ? (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải cấu hình...
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Tên trợ lý</label>
                      <input
                        value={settings.bot_name}
                        onChange={(e) => setSettings({ ...settings, bot_name: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Thương hiệu</label>
                      <input
                        value={settings.brand_intro}
                        onChange={(e) => setSettings({ ...settings, brand_intro: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Phong cách hỏi khách (Questioning Mode)
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs ${
                          settings.questioning_mode === "step_by_step"
                            ? "border-blue-500 bg-blue-50/70 text-blue-900"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        <input
                          type="radio"
                          checked={settings.questioning_mode === "step_by_step"}
                          onChange={() => setSettings({ ...settings, questioning_mode: "step_by_step" })}
                          className="mt-0.5"
                        />
                        <span>
                          <strong className="block">Step-by-step (Tư vấn 3 bước)</strong>
                          Hỏi 1–2 câu thấu hiểu nhu cầu trước khi gợi ý phòng.
                        </span>
                      </label>
                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-xs ${
                          settings.questioning_mode === "express"
                            ? "border-blue-500 bg-blue-50/70 text-blue-900"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        <input
                          type="radio"
                          checked={settings.questioning_mode === "express"}
                          onChange={() => setSettings({ ...settings, questioning_mode: "express" })}
                          className="mt-0.5"
                        />
                        <span>
                          <strong className="block">Express (Nhanh gọn)</strong>
                          Đi thẳng vào gợi ý các hạng phòng phù hợp ngay.
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Persona Prompt</label>
                    <textarea
                      rows={2}
                      value={settings.persona_prompt}
                      onChange={(e) => setSettings({ ...settings, persona_prompt: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Chiến lược đặt câu hỏi (Consultative Selling)
                    </label>
                    <textarea
                      rows={3}
                      value={settings.questioning_strategy_prompt}
                      onChange={(e) => setSettings({ ...settings, questioning_strategy_prompt: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Quy tắc đề xuất & nêu lý do phù hợp
                    </label>
                    <textarea
                      rows={2}
                      value={settings.recommendation_prompt}
                      onChange={(e) => setSettings({ ...settings, recommendation_prompt: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs leading-relaxed focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Số phòng gợi ý tối đa ({settings.max_recommendations})
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={settings.max_recommendations}
                        onChange={(e) =>
                          setSettings({ ...settings, max_recommendations: Number(e.target.value) })
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Độ sáng tạo / Temperature ({settings.temperature.toFixed(1)})
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={settings.temperature}
                        onChange={(e) => setSettings({ ...settings, temperature: Number(e.target.value) })}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Lưu & Áp dụng ngay
                    </button>
                  </div>
                </>
              )}
            </form>

            {/* Right: Live Playground */}
            <div className="flex h-[640px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm lg:col-span-5">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-900">Live Playground</span>
                </div>
                <button
                  type="button"
                  onClick={resetPlayground}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3 w-3" /> Làm mới
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
                {playgroundMsgs.map((m) => (
                  <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                        m.role === "user"
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-800"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {playgroundBusy && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> AI đang tư vấn...
                  </div>
                )}
              </div>

              {lastModelChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                  {lastModelChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => void sendPlayground(chip)}
                      className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-700 transition hover:bg-blue-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendPlayground();
                }}
                className="flex items-center gap-2 border-t border-slate-200 p-3"
              >
                <input
                  value={playgroundInput}
                  onChange={(e) => setPlaygroundInput(e.target.value)}
                  placeholder="Nhập câu hỏi test (VD: tư vấn phòng đi nghỉ dưỡng)..."
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={playgroundBusy || !playgroundInput.trim()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Test RAG Knowledge */}
        {activeTab === "rag" && (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <form onSubmit={runRagSearch} className="flex flex-wrap gap-2">
              <input
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                placeholder="Nhập từ khóa hoặc câu hỏi để kiểm tra Vector Store trích xuất đoạn nào (VD: giờ check-in, hủy phòng, đưa đón sân bay)..."
                className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={ragBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {ragBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Kiểm tra trích xuất RAG
              </button>
            </form>

            <div className="space-y-3">
              {ragChunks.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  Nhập câu truy vấn phía trên để xem các đoạn tri thức (chunks) và điểm tương đồng Cosine Similarity.
                </p>
              ) : (
                ragChunks.map((chunk, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-700">
                        Chunk #{idx + 1} · {String(chunk.metadata?.category || "Chung")} ·{" "}
                        {String(chunk.metadata?.hotel_name || "Toàn hệ thống")}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        Score: {chunk.score}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">{chunk.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Analytics */}
        {activeTab === "analytics" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Tổng lượt AI tư vấn có ghi nhận</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">
                  {analyticsBusy ? "..." : (analytics?.totalConsultations ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Lượt bấm đặt phòng từ AI</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-600">
                  {analyticsBusy ? "..." : (analytics?.bookingClicks ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-slate-500">Tỉ lệ chuyển đổi</p>
                <p className="mt-1 text-2xl font-extrabold text-blue-600">
                  {analyticsBusy ? "..." : `${analytics?.conversionRate ?? 0}%`}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-slate-900">Top nhu cầu khách hỏi</h3>
                {analytics?.topNeeds?.length ? (
                  <div className="space-y-2">
                    {analytics.topNeeds.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 font-bold text-blue-700">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Chưa có dữ liệu nhu cầu được ghi nhận.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-3 text-sm font-bold text-slate-900">Hạng phòng được AI gợi ý nhiều nhất</h3>
                {analytics?.topRoomTypes?.length ? (
                  <div className="space-y-2">
                    {analytics.topRoomTypes.map((item) => (
                      <div key={item.roomType} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                        <span className="font-semibold text-slate-700">{item.roomType}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Chưa có dữ liệu gợi ý hạng phòng.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
