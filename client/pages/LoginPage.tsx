import { FormEvent, useEffect, useState } from "react";

import { ArrowLeft, ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useLoginMutation, useRequestPasswordResetMutation, useResetPasswordMutation } from "../services/authApi";
import { useAppDispatch } from "../store/hooks";
import { getRolesFromToken, setCredentials } from "../store/authSlice";
import { useNavigate } from "react-router-dom";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "../components/ui/input-otp";

type LoginPageProps = { onLogin: () => void };

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [login, { isLoading }] = useLoginMutation();
  const [requestPasswordReset, { isLoading: isRequestingOtp }] = useRequestPasswordResetMutation();
  const [resetPassword, { isLoading: isResettingPassword }] = useResetPasswordMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"login" | "requestOtp" | "resetPassword">("login");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("credentials-updated") === "true") {
      sessionStorage.removeItem("credentials-updated");
      setNotice("Email hoặc mật khẩu đã thay đổi. Vui lòng đăng nhập lại bằng thông tin mới.");
    }
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice("");
    try {
      const result = await login({ email, password }).unwrap();
      localStorage.setItem("id", String(result.id));
      sessionStorage.removeItem("accountPassword");
      dispatch(setCredentials(result)); // result: { token, email, fullName }
      onLogin();
      navigate(getRolesFromToken(result.token).includes("ROLE_SUPER_ADMIN") ? "/admin" : "/overview", { replace: true });
    } catch (err: any) {
      // err.data là phần "data" mà axiosBaseQuery trả về khi lỗi
      const message =
        err?.data?.message ?? "Đăng nhập thất bại, vui lòng thử lại";
      setError(message);
    }
  };

  const sendPasswordResetOtp = async () => {
    setError(null);
    setNotice("");
    try {
      await requestPasswordReset({ email: email.trim() }).unwrap();
      setView("resetPassword");
      setNotice(`Mã OTP đã được gửi đến ${email.trim()}. Mã có hiệu lực trong 5 phút.`);
    } catch (err: any) {
      setError(err?.data?.message ?? "Không thể gửi mã OTP. Vui lòng kiểm tra email và thử lại.");
    }
  };

  const handleRequestOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await sendPasswordResetOtp();
  };

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Vui lòng nhập mã OTP gồm 6 chữ số.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Mật khẩu mới cần có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    try {
      await resetPassword({
        email: email.trim(),
        otp,
        newPassword,
        confirmPassword,
      }).unwrap();
      setView("login");
      setPassword("");
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.");
    } catch (err: any) {
      setError(err?.data?.message ?? "Không thể đặt lại mật khẩu. Vui lòng kiểm tra OTP và thử lại.");
    }
  };

  const goToLogin = () => {
    setView("login");
    setError(null);
    setNotice("");
  };

  return (
    <main className="login-shell relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="login-grid" aria-hidden="true" />
      <div className="login-orb login-orb-one" aria-hidden="true" />
      <div className="login-orb login-orb-two" aria-hidden="true" />
      <div className="login-orb login-orb-three" aria-hidden="true" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <img
            src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=85"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-blue-950/75 to-slate-950/50" />
          <div className="login-panel-lines" aria-hidden="true" />
          <div className="relative z-10 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-200/30 bg-amber-300/15 text-amber-200">
              <Building2 size={22} />
            </span>
            <div>
              <p className="text-lg font-extrabold tracking-[0.18em]">SEN VIET</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100/70">Hotel management</p>
            </div>
          </div>
          <div className="relative z-10 pb-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Không gian vận hành</p>
            <h1 className="max-w-md text-4xl font-extrabold leading-[1.12] tracking-tight text-white">Trải nghiệm quản lý khách sạn thật dễ dàng.</h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-blue-50/80">Mọi chi nhánh, mọi ca làm và mọi trải nghiệm lưu trú — kết nối trong một nền tảng.</p>
          </div>
          <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/35 p-4 backdrop-blur-md">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><ShieldCheck size={20} /></div>
            <div><p className="text-sm font-bold">An toàn & bảo mật</p><p className="mt-0.5 text-xs text-blue-100/70">Dữ liệu chi nhánh luôn được bảo vệ</p></div>
          </div>
        </section>
        <section className="flex min-h-[600px] items-center px-6 py-10 sm:px-12 lg:min-h-[620px] lg:px-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9 flex items-center gap-3 lg:hidden">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-950 text-amber-300"><Building2 size={22} /></span>
              <div><p className="font-extrabold tracking-[0.16em] text-slate-950">SEN VIET</p><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Hotel management</p></div>
            </div>
            {view === "login" && <>
            <div>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">Đăng nhập tài khoản</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Sử dụng email công việc để tiếp tục quản lý khách sạn.</p>
            </div>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block text-sm font-semibold text-slate-700">
                Email công việc
                <div className="relative mt-2">
                  <Mail size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
                  <input type="email" autoComplete="username" required value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="nhanvien@senviet.vn" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
                </div>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Mật khẩu
                <div className="relative mt-2">
                  <LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" />
                  <input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Nhập mật khẩu" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-11 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" />
                  <button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                </div>
              </label>
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-500"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Ghi nhớ đăng nhập</label>
                <button type="button" onClick={() => { setView("requestOtp"); setError(null); setNotice(""); }} className="font-semibold text-blue-700 hover:text-blue-900">Quên mật khẩu?</button>
              </div>
              {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
              {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{notice}</p>}
              <button type="submit" disabled={isLoading} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800 hover:shadow-blue-700/30 disabled:cursor-wait disabled:opacity-70">
                {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
                {!isLoading && <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>
            </>}
            {view === "requestOtp" && <>
              <button type="button" onClick={goToLogin} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"><ArrowLeft size={16} />Quay lại đăng nhập</button>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">Quên mật khẩu?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Nhập email tài khoản. Chúng tôi sẽ gửi mã OTP để xác thực đặt lại mật khẩu.</p>
              </div>
              <form onSubmit={handleRequestOtp} className="mt-8 space-y-5">
                <label className="block text-sm font-semibold text-slate-700">Email tài khoản<div className="relative mt-2"><Mail size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" /><input type="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setError(null); }} placeholder="nhanvien@senviet.vn" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /></div></label>
                {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
                <button type="submit" disabled={isRequestingOtp} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-bold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70">{isRequestingOtp ? "Đang gửi mã OTP..." : "Gửi mã OTP"}<ArrowRight size={17} /></button>
              </form>
            </>}
            {view === "resetPassword" && <>
              <button type="button" onClick={() => { setView("requestOtp"); setError(null); setNotice(""); }} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"><ArrowLeft size={16} />Đổi email</button>
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">Xác thực OTP</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Nhập mã 6 chữ số đã gửi đến <strong>{email}</strong>, sau đó tạo mật khẩu mới.</p>
              </div>
              <form onSubmit={handleResetPassword} className="mt-7 space-y-5">
                {notice && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{notice}</p>}
                <div><label className="mb-2 block text-sm font-semibold text-slate-700">Mã OTP</label><InputOTP maxLength={6} pattern="^[0-9]+$" value={otp} onChange={(value) => { setOtp(value); setError(null); }} aria-label="Mã OTP gồm 6 chữ số" containerClassName="justify-between"><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup></InputOTP></div>
                <label className="block text-sm font-semibold text-slate-700">Mật khẩu mới<div className="relative mt-2"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" /><input type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={6} required value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setError(null); }} placeholder="Ít nhất 6 ký tự" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-11 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /><button type="button" aria-label={showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"} onClick={() => setShowNewPassword((visible) => !visible)} className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-700">{showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
                <label className="block text-sm font-semibold text-slate-700">Xác nhận mật khẩu mới<div className="relative mt-2"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" /><input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setError(null); }} placeholder="Nhập lại mật khẩu mới" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-11 text-sm font-normal text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /><button type="button" aria-label={showConfirmPassword ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"} onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-700">{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
                {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}
                <button type="submit" disabled={isResettingPassword || otp.length !== 6} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-bold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70">{isResettingPassword ? "Đang xác thực..." : "Xác thực và đổi mật khẩu"}<ArrowRight size={17} /></button>
                <button type="button" disabled={isRequestingOtp} onClick={() => void sendPasswordResetOtp()} className="w-full text-center text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-50">{isRequestingOtp ? "Đang gửi lại mã..." : "Gửi lại mã OTP"}</button>
              </form>
            </>}
            <p className="mt-8 text-center text-xs text-slate-400">Cần hỗ trợ? <button type="button" className="font-semibold text-slate-600 hover:text-blue-700">Liên hệ quản trị viên</button></p>
            <p className="mt-10 text-center text-[10px] font-medium tracking-wide text-slate-300">© SEN VIET · HOTEL MANAGEMENT</p>
          </div>
        </section>
      </div>
    </main>
  );
}