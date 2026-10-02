import { FormEvent, useState } from "react";
import { Plus, UserRound, X, Edit, Phone, Mail, CreditCard, MapPin, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAppSelector } from "../store/hooks";
import { toast } from "@/components/ui/use-toast";
import {
  useGetEmployeesByHotelQuery,
  useCreateStaffMutation,
  useUpdateStaffMutation,
  EmployeeResponse,
} from "../services/employeeApi";

const fallbackEmployees: EmployeeResponse[] = [
  {
    id: "102",
    fullName: "Trần Minh Tuấn",
    position: "Giám Đốc Chi Nhánh Sài Gòn",
    email: "admin.saigon@senviet.vn",
    phone: "0901111111",
    cccd: "079201002222",
    address: "45 Lê Duẩn, Q.1, TP.HCM",
    avatarUrl: "",
    hotelId: 1,
    hotelName: "Sen Việt Sài Gòn",
  },
  {
    id: "104",
    fullName: "Lê Thị Thu Thảo",
    position: "Lễ Tân Trưởng (Ca Sáng 06h-14h)",
    email: "letan.saigon@senviet.vn",
    phone: "0903333331",
    cccd: "079301004444",
    address: "12 Nguyễn Đình Chiểu, Q.3, TP.HCM",
    avatarUrl: "",
    hotelId: 1,
    hotelName: "Sen Việt Sài Gòn",
  },
  {
    id: "105",
    fullName: "Nguyễn Quốc Bảo",
    position: "Nhân Viên Lễ Tân (Ca Tối 14h-22h)",
    email: "letan2.saigon@senviet.vn",
    phone: "0903333332",
    cccd: "079301005555",
    address: "56 Cách Mạng Tháng 8, Q.10, TP.HCM",
    avatarUrl: "",
    hotelId: 1,
    hotelName: "Sen Việt Sài Gòn",
  },
  {
    id: "106",
    fullName: "Đặng Thị Cẩm Tú",
    position: "Nhân Viên Buồng Phòng",
    email: "buongphong.saigon@senviet.vn",
    phone: "0904444441",
    cccd: "079301006666",
    address: "78 Bình Thới, Q.11, TP.HCM",
    avatarUrl: "",
    hotelId: 1,
    hotelName: "Sen Việt Sài Gòn",
  },
];

export default function EmployeeDirectory() {
  const currentHotelId = useAppSelector((state) => state.auth.hotelId) || 1;
  const { data: employees = [], isLoading, isError, refetch } = useGetEmployeesByHotelQuery(Number(currentHotelId));
  const displayEmployees = employees && employees.length > 0 ? employees : fallbackEmployees;
  const [createStaff, { isLoading: isCreating }] = useCreateStaffMutation();
  const [updateStaff, { isLoading: isUpdating }] = useUpdateStaffMutation();

  // Modal thêm nhân viên
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Nhân Viên Lễ Tân");
  const [email, setEmail] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Modal chỉnh sửa nhân viên
  const [editOpen, setEditOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<EmployeeResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("Nhân Viên Lễ Tân");
  const [editPhone, setEditPhone] = useState("");
  const [editCccd, setEditCccd] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);

  // Thông báo feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const getInitials = (fullName: string) => {
    if (!fullName) return "NV";
    return fullName.trim().split(" ").map((p) => p[0]).slice(-2).join("").toUpperCase();
  };

  const getRoleBadge = (pos?: string) => {
    const p = (pos || "").toLowerCase();
    if (p.includes("lễ tân") || p.includes("letan") || p.includes("reception")) {
      return { label: pos || "Lễ tân", badge: "bg-blue-100 text-blue-700 border-blue-200" };
    }
    if (p.includes("buồng") || p.includes("phòng") || p.includes("housekeeping")) {
      return { label: pos || "Buồng phòng", badge: "bg-amber-100 text-amber-700 border-amber-200" };
    }
    if (p.includes("quản lý") || p.includes("admin") || p.includes("giám đốc")) {
      return { label: pos || "Quản lý", badge: "bg-purple-100 text-purple-700 border-purple-200" };
    }
    return { label: pos || "Nhân viên", badge: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  const handleAddSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const staffInfo = {
        fullName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        cccd: identityNumber.trim(),
        address: address.trim(),
        position: role,
        hotelId: Number(currentHotelId),
      };

      const formData = new FormData();
      formData.append(
        "staffInfo",
        new Blob([JSON.stringify(staffInfo)], { type: "application/json" })
      );
      if (avatarFile) {
        formData.append("avatarUrl", avatarFile);
      }

      await createStaff(formData).unwrap();
      const successMsg = `Tạo nhân viên "${name}" thành công! Mật khẩu đăng nhập mặc định là 1111.`;
      setFeedback({
        type: "success",
        text: successMsg,
      });
      toast({
        title: "Tạo nhân viên thành công",
        description: successMsg,
      });
      // Reset form
      setName("");
      setEmail("");
      setIdentityNumber("");
      setPhone("");
      setAddress("");
      setAvatarFile(null);
      setAddOpen(false);
      refetch();
    } catch (err: any) {
      let msg = err?.data?.message || err?.message || "Tạo nhân viên thất bại. Vui lòng kiểm tra lại thông tin.";
      if (err?.status === 403 || msg.includes("4003") || msg.toLowerCase().includes("access denied")) {
        msg = "[4003] Quyền bị từ chối: Tài khoản của bạn không có quyền Quản trị (Admin) hoặc Quản lý (Manager) để thêm nhân sự. Vui lòng đăng nhập bằng tài khoản Quản lý chi nhánh hoặc Quản trị viên!";
      }
      setFeedback({ type: "error", text: msg });
      toast({
        variant: "destructive",
        title: "Thêm nhân viên thất bại",
        description: msg,
      });
    }
  };

  const openEditModal = (staff: EmployeeResponse) => {
    setEditingStaff(staff);
    setEditName(staff.fullName || "");
    setEditRole(staff.position || "Nhân Viên Lễ Tân");
    setEditPhone(staff.phone || "");
    setEditCccd(staff.cccd || "");
    setEditAddress(staff.address || "");
    setEditAvatarFile(null);
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStaff) return;
    setFeedback(null);
    try {
      const staffInfo = {
        fullName: editName.trim(),
        phone: editPhone.trim(),
        cccd: editCccd.trim(),
        address: editAddress.trim(),
        position: editRole,
        hotelId: Number(currentHotelId),
      };

      const formData = new FormData();
      formData.append(
        "staffInfo",
        new Blob([JSON.stringify(staffInfo)], { type: "application/json" })
      );
      if (editAvatarFile) {
        formData.append("avatarUrl", editAvatarFile);
      }

      await updateStaff({ id: editingStaff.id, formData }).unwrap();
      const successEditMsg = `Cập nhật hồ sơ nhân viên "${editName}" thành công!`;
      setFeedback({
        type: "success",
        text: successEditMsg,
      });
      toast({
        title: "Cập nhật thành công",
        description: successEditMsg,
      });
      setEditOpen(false);
      refetch();
    } catch (err: any) {
      let msg = err?.data?.message || err?.message || "Cập nhật hồ sơ thất bại.";
      if (err?.status === 403 || msg.includes("4003") || msg.toLowerCase().includes("access denied")) {
        msg = "[4003] Quyền bị từ chối: Chỉ Quản lý (Manager) hoặc Quản trị viên (Admin) mới có quyền chỉnh sửa hồ sơ nhân sự!";
      }
      setFeedback({ type: "error", text: msg });
      toast({
        variant: "destructive",
        title: "Cập nhật hồ sơ thất bại",
        description: msg,
      });
    }
  };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserRound size={18} className="text-blue-600" />
            <h3 className="font-bold text-slate-900">Danh sách nhân viên</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {displayEmployees.length} nhân sự đang làm việc tại chi nhánh hiện tại.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setAddOpen(true);
          }}
          className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={15} />
          Thêm nhân viên
        </button>
      </div>

      {/* Banner thông báo */}
      {feedback && (
        <div
          className={`mx-5 mt-4 flex items-center gap-2 rounded-xl border p-3.5 text-xs font-medium ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-auto text-sm leading-none opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin text-blue-600" />
          <span>Đang tải danh sách nhân viên từ máy chủ...</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="mx-5 my-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>Chưa kết nối được danh sách từ máy chủ (Đang hiển thị dữ liệu lưu tạm). Vui lòng khởi động lại Backend trong IntelliJ hoặc kiểm tra phiên đăng nhập.</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-3 shrink-0 rounded-lg bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Danh sách nhân viên */}
      {!isLoading && displayEmployees.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-400">
          Chưa có nhân viên nào tại chi nhánh này. Bấm "Thêm nhân viên" để tạo tài khoản mới!
        </div>
      )}

      {!isLoading && displayEmployees.length > 0 && (
        <div className="divide-y divide-slate-100 px-5">
          {displayEmployees.map((employee) => {
            const roleBadge = getRoleBadge(employee.position);
            return (
              <article
                key={employee.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {employee.avatarUrl ? (
                    <img
                      src={employee.avatarUrl}
                      alt={employee.fullName}
                      className="h-11 w-11 shrink-0 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                      {getInitials(employee.fullName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">{employee.fullName}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleBadge.badge}`}
                      >
                        {roleBadge.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      {employee.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} className="text-slate-400" />
                          {employee.email}
                        </span>
                      )}
                      {employee.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" />
                          {employee.phone}
                        </span>
                      )}
                      {employee.cccd && (
                        <span className="flex items-center gap-1">
                          <CreditCard size={12} className="text-slate-400" />
                          CCCD: {employee.cccd}
                        </span>
                      )}
                      {employee.address && (
                        <span className="hidden sm:flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin size={12} className="text-slate-400" />
                          {employee.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(employee)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-blue-600"
                  >
                    <Edit size={13} />
                    Sửa hồ sơ
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal Thêm Nhân Viên */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={() => setAddOpen(false)}
        >
          <form
            onSubmit={handleAddSubmit}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Nhân sự chi nhánh</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">Thêm nhân viên mới</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Mật khẩu mặc định cấp cho tài khoản nhân viên mới là <strong className="text-blue-600">1111</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Ảnh đại diện nhân viên
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  className="mt-1.5 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-blue-700"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Họ và tên <span className="text-red-500">*</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nhập họ và tên đầy đủ"
                  required
                  autoFocus
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Chức vụ <span className="text-red-500">*</span>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  required
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Nhân Viên Lễ Tân">Nhân Viên Lễ Tân</option>
                  <option value="Lễ Tân Trưởng (Ca Sáng 06h-14h)">Lễ Tân Trưởng (Ca Sáng 06h-14h)</option>
                  <option value="Nhân Viên Lễ Tân (Ca Tối 14h-22h)">Nhân Viên Lễ Tân (Ca Tối 14h-22h)</option>
                  <option value="Nhân Viên Buồng Phòng">Nhân Viên Buồng Phòng</option>
                  <option value="Quản lý">Quản lý chi nhánh</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Email đăng nhập <span className="text-red-500">*</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@senviet.vn"
                  required
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                CCCD / CMND <span className="text-red-500">*</span>
                <input
                  value={identityNumber}
                  onChange={(event) => setIdentityNumber(event.target.value)}
                  placeholder="Nhập 12 số CCCD"
                  required
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Số điện thoại <span className="text-red-500">*</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="090 123 4567"
                  required
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Địa chỉ thường trú <span className="text-red-500">*</span>
                <textarea
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Nhập địa chỉ nơi ở hiện tại"
                  required
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreating && <Loader2 size={16} className="animate-spin" />}
                {isCreating ? "Đang lưu..." : "Lưu nhân viên"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Chỉnh Sửa Nhân Viên */}
      {editOpen && editingStaff && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"
          onMouseDown={() => setEditOpen(false)}
        >
          <form
            onSubmit={handleEditSubmit}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Cập nhật hồ sơ</p>
                <h3 className="mt-1 text-xl font-bold text-slate-900">Chỉnh sửa thông tin nhân viên</h3>
                <p className="mt-0.5 text-xs text-slate-500">Mã nhân viên: {editingStaff.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="text-2xl leading-none text-slate-400 hover:text-slate-700"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Thay đổi ảnh đại diện (Tùy chọn)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditAvatarFile(e.target.files?.[0] || null)}
                  className="mt-1.5 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-blue-700"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Họ và tên <span className="text-red-500">*</span>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="Nhập họ và tên"
                  required
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Chức vụ <span className="text-red-500">*</span>
                <select
                  value={editRole}
                  onChange={(event) => setEditRole(event.target.value)}
                  required
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400"
                >
                  <option value="Nhân Viên Lễ Tân">Nhân Viên Lễ Tân</option>
                  <option value="Lễ Tân Trưởng (Ca Sáng 06h-14h)">Lễ Tân Trưởng (Ca Sáng 06h-14h)</option>
                  <option value="Nhân Viên Lễ Tân (Ca Tối 14h-22h)">Nhân Viên Lễ Tân (Ca Tối 14h-22h)</option>
                  <option value="Nhân Viên Buồng Phòng">Nhân Viên Buồng Phòng</option>
                  <option value="Quản lý">Quản lý chi nhánh</option>
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Email (Chỉ xem)
                <input
                  type="email"
                  value={editingStaff.email || ""}
                  disabled
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-500 outline-none cursor-not-allowed"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                CCCD / CMND <span className="text-red-500">*</span>
                <input
                  value={editCccd}
                  onChange={(event) => setEditCccd(event.target.value)}
                  placeholder="Nhập CCCD"
                  required
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Số điện thoại <span className="text-red-500">*</span>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(event) => setEditPhone(event.target.value)}
                  placeholder="090 123 4567"
                  required
                  className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Địa chỉ thường trú <span className="text-red-500">*</span>
                <textarea
                  value={editAddress}
                  onChange={(event) => setEditAddress(event.target.value)}
                  placeholder="Nhập địa chỉ"
                  required
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isUpdating && <Loader2 size={16} className="animate-spin" />}
                {isUpdating ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
