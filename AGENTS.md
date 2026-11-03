# SEN VIỆT HOTEL - STAFF MANAGEMENT FRONTEND GUIDELINES
<!-- Quy chuẩn lập trình Tối giản & Kỷ luật cao (Karpathy + Ponytail Standard) -->

This file defines the strict behavioral rules and coding guidelines for AI agents working on the Sen Việt Staff & Admin Portal repository.

---

## 1. COMMUNICATION & LANGUAGE (GIAO TIẾP VỚI LẬP TRÌNH VIÊN)
- **Developer Communication**: Always reply to the developer in Vietnamese (Tiếng Việt) clearly, honestly, and concisely.
- **End of Response**: End every reply with 1-2 lines summarizing: (1) exact files/lines modified, (2) what was skipped or untouched, (3) any edge-case risks.
- **Multilingual Context**: Maintain proper i18n keys and support both Vietnamese (default) and English/multilingual data where required.

---

## 2. ANDREJ KARPATHY 4 GOLDEN RULES (4 NGUYÊN TẮC VÀNG KARPATHY)

### Rule 1: Think Before Coding (Suy nghĩ trước khi gõ phím)
- Never assume user requirements or guess blindly. If unclear, stop and ask.
- When multiple architectural or UI approaches exist, state the tradeoffs explicitly before implementing.
- If a simpler approach exists, propose it before coding.

### Rule 2: Simplicity First (Tối giản là trên hết)
- Minimum code that solves the problem. Nothing speculative.
- No unused abstractions, helper wrappers, or extra configuration for single-use logic.
- Do NOT install new npm packages when native browser APIs or existing packages already do the job.
- If you write 150 lines and it can be done cleanly in 40 lines, rewrite it.

### Rule 3: Surgical Changes (Can thiệp chuẩn xác như phẫu thuật)
- Touch ONLY what is necessary to solve the issue. Keep blast radius minimal.
- Do NOT "improve" or reformat adjacent code, untouched components, or existing comments.
- Match existing table, form, modal, and state management patterns.
- Clean up only your own orphans (unused imports/variables that your edit created).

### Rule 4: Goal-Driven Execution (Làm việc theo mục tiêu kiểm chứng được)
- Transform tasks into verifiable criteria before declaring completion.
- Verify changes directly against the running development server (Port 8082).

---

## 3. PONYTAIL SENIOR DEV PRINCIPLES (TƯ DUY SENIOR LƯỜI)
- *"The best code is the code never written."* (Dòng code tốt nhất là dòng code không bao giờ phải viết).
- Deletion beats addition.
- Decision hierarchy before writing new code:
  1. Does this feature/code actually need to exist? Skip unrequested options.
  2. Already in this codebase? Reuse existing UI components (`components/ui/*`), table layouts, and hooks.
  3. Standard browser/React feature? Use native React APIs.
  4. Installed npm dependency? Use existing icons (`lucide-react`), utilities (`clsx`, `tailwind-merge`).

---

## 4. PROJECT ARCHITECTURE & RUNTIME
- **Tech Stack**: React 18, Vite, TypeScript, TailwindCSS, Lucide React, WebSocket (Socket.IO client).
- **Dev Server Port**: `8082` (`npm run dev`)
- **Key Modules**:
  - `client/pages/LiveChat.tsx` & `client/components/LiveChatWidget.tsx`: Real-time staff-customer chat and unread message management.
  - `client/pages/Bookings.tsx`: Booking lifecycle management (Pending, Confirmed, Checked In, Checked Out, Cancelled).
  - `client/pages/AdminAIChat.tsx`: Internal Admin/Staff AI assistant for scheduling and metrics.
