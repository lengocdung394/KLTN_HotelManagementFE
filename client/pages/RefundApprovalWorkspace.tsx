import { ClipboardCheck } from "lucide-react";

export default function RefundApprovalWorkspace() {
  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
            <ClipboardCheck size={20} />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">Duyệt hoàn tiền booking đã hủy</h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Danh sách booking đã hủy có khoản tiền cần hoàn sẽ được quản lý tại đây. Giao diện hiện đang chờ kết nối dữ liệu và thao tác duyệt hoàn tiền.
            </p>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Ngày hủy</th>
                  <th className="px-4 py-3 text-right">Số tiền cần hoàn</th>
                  <th className="px-4 py-3">Trạng thái hoàn tiền</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <ClipboardCheck size={24} className="mx-auto text-slate-300" />
                    <p className="mt-3 text-sm font-semibold text-slate-700">Chưa có dữ liệu hoàn tiền</p>
                    <p className="mt-1 text-xs text-slate-500">Các booking hủy cần xử lý sẽ hiển thị tại đây.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
