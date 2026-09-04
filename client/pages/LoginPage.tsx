import { FormEvent, useState } from "react";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useLoginMutation } from "../services/authApi";
import { useAppDispatch } from "../store/hooks";
import { setCredentials } from "../store/authSlice";
import { useNavigate } from "react-router-dom";

type LoginPageProps = { onLogin: () => void };

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [login, { isLoading }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await login({ email, password }).unwrap();
      dispatch(setCredentials(result)); // result: { token, email, fullName }
      onLogin();
      navigate("/overview", { replace: true });
    } catch (err: any) {
      // err.data là phần "data" mà axiosBaseQuery trả về khi lỗi
      const message =
        err?.data?.message ?? "Đăng nhập thất bại, vui lòng thử lại";
      setError(message);
    }
  };

  return (
    <main className="login-shell relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="login-grid" aria-hidden="true" /><div className="login-orb login-orb-one" aria-hidden="true" /><div className="login-orb login-orb-two" aria-hidden="true" /><div className="login-orb login-orb-three" aria-hidden="true" />
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/60 bg-white/90 shadow-[0_30px_100px_rgba(15,23,42,0.24)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-[620px] overflow-hidden bg-blue-950 p-10 text-white lg:flex lg:flex-col lg:justify-center">
          <div className="login-panel-lines" aria-hidden="true" />
          <p className="absolute left-10 top-10 z-10 text-lg font-bold uppercase tracking-[0.18em] text-amber-300">Chào mừng trở lại</p><div className="relative z-10"><h1 className="max-w-md text-4xl font-extrabold leading-[1.12] tracking-tight text-white">Mọi ca làm, mọi căn phòng, trong tầm tay.</h1><p className="mt-5 max-w-sm text-sm leading-6 text-blue-100/75">Điều hành khách sạn nhẹ nhàng hơn với một không gian làm việc rõ ràng và luôn sẵn sàng.</p></div>
          <div className="absolute bottom-10 left-10 right-10 z-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><ShieldCheck size={20} /></div><div><p className="text-sm font-bold">Không gian an toàn</p><p className="mt-0.5 text-xs text-blue-100/65">Dữ liệu chi nhánh được bảo vệ</p></div></div>
        </section>
        <section className="flex min-h-[620px] items-center p-6 sm:p-10 lg:p-12"><div className="mx-auto w-full max-w-sm">
          <div className="mb-9 lg:hidden" />
          <div><p className="text-sm font-semibold text-blue-600">Đăng nhập hệ thống</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">Xin chào, Linh</h2><p className="mt-2 text-sm leading-6 text-slate-500">Đăng nhập để tiếp tục quản lý chi nhánh của bạn.</p></div>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5"><label className="block text-sm font-semibold text-slate-700">Email công việc<div className="relative mt-2"><Mail size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" /><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="linh@staywise.vn" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /></div></label><label className="block text-sm font-semibold text-slate-700">Mật khẩu<div className="relative mt-2"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-slate-400" /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Nhập mật khẩu" className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-11 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /><button type="button" aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><div className="flex items-center justify-between text-xs"><label className="flex items-center gap-2 text-slate-500"><input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />Ghi nhớ đăng nhập</label><button type="button" className="font-semibold text-blue-600 hover:text-blue-800">Quên mật khẩu?</button></div>{error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}<button type="submit" className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 hover:shadow-blue-600/30">Đăng nhập<ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" /></button></form>
          <p className="mt-8 text-center text-xs text-slate-400">Cần hỗ trợ? <button type="button" className="font-semibold text-slate-600 hover:text-blue-600">Liên hệ quản trị viên</button></p>
        </div></section>
      </div>
    </main>
  );
}