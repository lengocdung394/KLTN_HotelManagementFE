import { useState } from "react";
import { Check, CircleUserRound, LoaderCircle, Save } from "lucide-react";
import { useUpdateMyProfileMutation } from "../services/employeeApi";
import { logout, updateProfile } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

type SuperAdminProfileSettingsProps = {
  onLogout: () => void;
};

export default function SuperAdminProfileSettings({ onLogout }: SuperAdminProfileSettingsProps) {
  const dispatch = useAppDispatch();
  const { fullName, email, position } = useAppSelector((state) => state.auth);
  const [updateMyProfile, { isLoading }] = useUpdateMyProfileMutation();
  const [form, setForm] = useState({
    fullName: fullName ?? "",
    email: email ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSaved(false);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved(false);

    if (!form.currentPassword) {
      setError("Nhập mật khẩu hiện tại để xác nhận thay đổi.");
      return;
    }
    if (form.newPassword && form.newPassword.length < 8) {
      setError("Mật khẩu mới cần có ít nhất 8 ký tự.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    try {
      const emailChanged = form.email.trim() !== (email ?? "").trim();
      const passwordChanged = Boolean(form.newPassword);
      const result = await updateMyProfile({
        currentPassword: form.currentPassword,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: "",
        cccd: "",
        address: "",
        position: "Quản trị hệ thống",
        ...(passwordChanged
          ? { newPassword: form.newPassword, confirmPassword: form.confirmPassword }
          : {}),
      }).unwrap();

      if (emailChanged || passwordChanged) {
        dispatch(logout());
        onLogout();
        return;
      }

      dispatch(updateProfile({
        fullName: result.fullName,
        email: result.email,
        position: result.position ?? position ?? "Quản trị hệ thống",
      }));
      setForm((current) => ({
        ...current,
        fullName: result.fullName,
        email: result.email,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      setSaved(true);
    } catch (saveError) {
      const message = saveError && typeof saveError === "object" && "data" in saveError
        ? (saveError as { data?: { message?: string } }).data?.message
        : undefined;
      setError(message ?? "Không thể cập nhật thông tin. Vui lòng thử lại.");
    }
  };

  return (
    <section className="mt-4 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-100 text-blue-700">
          <CircleUserRound size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Thông tin cá nhân</h2>
          <p className="mt-1 text-sm text-slate-500">Cập nhật hồ sơ và tài khoản Super Admin.</p>
        </div>
      </div>

      <form onSubmit={(event) => void save(event)} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Họ và tên
          <input
            required
            maxLength={150}
            value={form.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Email đăng nhập
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Mật khẩu hiện tại
          <input
            required
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(event) => updateField("currentPassword", event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Mật khẩu mới (không bắt buộc)
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.newPassword}
            onChange={(event) => updateField("newPassword", event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Xác nhận mật khẩu mới
          <input
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        {error && <p role="alert" className="text-sm font-medium text-rose-700 sm:col-span-2">{error}</p>}
        {saved && <p role="status" className="text-sm font-medium text-emerald-700 sm:col-span-2">Đã cập nhật thông tin cá nhân.</p>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
          <p className="text-xs text-slate-500">
            Đổi email hoặc mật khẩu sẽ đăng xuất để bạn đăng nhập lại bằng thông tin mới.
          </p>
          <button
            type="submit"
            disabled={isLoading || !form.fullName.trim() || !form.email.trim() || !form.currentPassword}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
            {isLoading ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </section>
  );
}
