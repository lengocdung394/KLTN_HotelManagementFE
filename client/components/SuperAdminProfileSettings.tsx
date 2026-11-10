import { useState } from "react";
import { Check, CircleUserRound, KeyRound, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useUpdateMyProfileMutation } from "../services/employeeApi";
import {
  useGetSuperAdminAccountsQuery,
  useUpdateSuperAdminAccountMutation,
} from "../services/superAdminApi";
import { useRequestPasswordResetLinkMutation } from "../services/authApi";
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
  const [updateSuperAdminAccount, { isLoading: isUpdatingAccount }] = useUpdateSuperAdminAccountMutation();
  const [requestPasswordResetLink, { isLoading: isRequestingPasswordReset }] = useRequestPasswordResetLinkMutation();
  const [form, setForm] = useState({
    fullName: fullName ?? "",
    email: email ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const emailChanged = form.email.trim() !== (email ?? "").trim();
  const nameChanged = form.fullName.trim() !== (fullName ?? "").trim();
  const passwordChanged = Boolean(form.newPassword);
  const isNameOnlyUpdate = nameChanged && !emailChanged && !passwordChanged;
  const requiresCurrentPassword = emailChanged || passwordChanged;
  const { data: accounts = [], isLoading: isLoadingAccounts } = useGetSuperAdminAccountsQuery("ALL", {
    skip: !isNameOnlyUpdate,
  });
  const currentSuperAdmin = accounts.find((account) =>
    account.email?.trim().toLocaleLowerCase() === (email ?? "").trim().toLocaleLowerCase()
    && (account.accountType === "SUPER_ADMIN" || account.roles.includes("ROLE_SUPER_ADMIN")),
  );
  const isSaving = isLoading || isUpdatingAccount;

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setSaved(false);
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaved(false);

    if (requiresCurrentPassword && !form.currentPassword) {
      setError(localizedText("Nhập mật khẩu hiện tại để xác nhận thay đổi.", "Enter your current password to confirm the changes."));
      return;
    }
    if (emailChanged && !passwordChanged) {
      setError(localizedText("Khi đổi email, vui lòng đặt mật khẩu mới.", "Please set a new password when changing your email."));
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
      if (isNameOnlyUpdate) {
        if (isLoadingAccounts) {
          setError(localizedText("Đang tải thông tin tài khoản, vui lòng thử lại.", "Account information is still loading. Please try again."));
          return;
        }
        if (!currentSuperAdmin?.accountId) {
          setError(localizedText("Không tìm thấy tài khoản Super Admin để cập nhật tên.", "Could not find the Super Admin account to update the name."));
          return;
        }
        const result = await updateSuperAdminAccount({
          accountId: currentSuperAdmin.accountId,
          request: { fullName: form.fullName.trim() },
        }).unwrap();
        dispatch(updateProfile({
          fullName: result.fullName ?? form.fullName.trim(),
          email: result.email ?? email ?? "",
          position: result.position ?? position ?? "Quản trị hệ thống",
        }));
        setForm((current) => ({
          ...current,
          fullName: result.fullName ?? form.fullName.trim(),
        }));
        setSaved(true);
        return;
      }

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

  const sendPasswordReset = async () => {
    setError("");
    setSaved(false);
    if (!email?.trim()) {
      setError(localizedText("Không tìm thấy email tài khoản để gửi yêu cầu đặt lại mật khẩu.", "No account email is available for a password reset request."));
      return;
    }
    try {
      await requestPasswordResetLink({ email: email.trim() }).unwrap();
      dispatch(logout());
      onLogout();
    } catch (resetError) {
      const message = resetError && typeof resetError === "object" && "data" in resetError
        ? (resetError as { data?: { message?: string } }).data?.message
        : undefined;
      setError(message ?? localizedText("Không thể gửi liên kết đặt lại mật khẩu. Vui lòng thử lại.", "Could not send the password reset link. Please try again."));
    }
  };

  return (
    <section className="mx-auto mt-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 px-5 py-5 sm:px-7">
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
              <p className="mt-0.5 text-xs text-slate-500">Bạn có thể cập nhật hồ sơ mà không cần đổi mật khẩu.</p>
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
              <p className="mt-0.5 text-xs text-slate-500">
                Tên cập nhật riêng; đổi email cần mật khẩu mới. Có thể gửi liên kết đặt lại mật khẩu qua email.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              Mật khẩu hiện tại {requiresCurrentPassword && <span className="text-rose-500">*</span>}
              <input
                required={requiresCurrentPassword}
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
            Đổi email cần đặt mật khẩu mới; đổi email hoặc mật khẩu sẽ đăng xuất bạn sau khi lưu.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void sendPasswordReset()}
              disabled={isSaving || isRequestingPasswordReset || isLoadingAccounts}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
            >
              {isRequestingPasswordReset && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Gửi liên kết đặt lại mật khẩu và đăng xuất
            </button>
            <button
              type="submit"
              disabled={isSaving || isRequestingPasswordReset || isLoadingAccounts || !form.fullName.trim() || !form.email.trim() || (requiresCurrentPassword && !form.currentPassword) || (emailChanged && !passwordChanged)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {isSaving || isLoadingAccounts ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
              {isSaving || isLoadingAccounts ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
