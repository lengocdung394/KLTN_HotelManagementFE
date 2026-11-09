import { useState } from "react";
import { Check, CircleUserRound, KeyRound, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useUpdateMyProfileMutation } from "../services/employeeApi";
import { logout, updateProfile } from "../store/authSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { localizedText } from "../i18n";

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
      setError(localizedText("Nhập mật khẩu hiện tại để xác nhận thay đổi.", "Enter your current password to confirm the changes."));
      return;
    }
    if (form.newPassword && form.newPassword.length < 8) {
      setError(localizedText("Mật khẩu mới cần có ít nhất 8 ký tự.", "The new password must be at least 8 characters."));
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError(localizedText("Mật khẩu xác nhận không khớp.", "The passwords do not match."));
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
      setError(message ?? localizedText("Không thể cập nhật thông tin. Vui lòng thử lại.", "Could not update your information. Please try again."));
    }
  };

  return (
    <section className="mt-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-5 py-5 sm:px-7">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-200">
          <CircleUserRound size={24} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">Thông tin cá nhân</h2>
          <p className="mt-1 text-sm text-slate-500">Cập nhật hồ sơ và tài khoản Super Admin.</p>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:inline-flex">
          <ShieldCheck size={14} />
          Quản trị hệ thống
        </span>
      </div>

      <form onSubmit={(event) => void save(event)} className="space-y-5 p-5 sm:p-7">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
              <CircleUserRound size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Hồ sơ cá nhân</h3>
              <p className="mt-0.5 text-xs text-slate-500">Tên hiển thị và email dùng để đăng nhập.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Họ và tên
              <input
                required
                maxLength={150}
                value={form.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Email đăng nhập
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700">
              <KeyRound size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Bảo mật tài khoản</h3>
              <p className="mt-0.5 text-xs text-slate-500">Xác nhận bằng mật khẩu hiện tại trước khi lưu thay đổi.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              Mật khẩu hiện tại
              <input
                required
                type="password"
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(event) => updateField("currentPassword", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              <span>Mật khẩu mới <span className="font-normal text-slate-400">(không bắt buộc)</span></span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={form.newPassword}
                onChange={(event) => updateField("newPassword", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              Xác nhận mật khẩu mới
              <input
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) => updateField("confirmPassword", event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
        </section>

        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}
        {saved && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">Đã cập nhật thông tin cá nhân.</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-slate-500">
            Đổi email hoặc mật khẩu sẽ đăng xuất để bạn đăng nhập lại bằng thông tin mới.
          </p>
          <button
            type="submit"
            disabled={isLoading || !form.fullName.trim() || !form.email.trim() || !form.currentPassword}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
          >
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
            {isLoading ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </section>
  );
}
