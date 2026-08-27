import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";

const roles = [
  { key: "branchManager", tone: "blue", permissions: [true, true, true, true, true, true] },
  { key: "receptionist", tone: "blue", permissions: [true, true, true, false, false, false] },
  { key: "housekeeping", tone: "amber", permissions: [false, true, true, false, false, false] },
  { key: "accountant", tone: "emerald", permissions: [false, false, false, true, true, false] },
];
const permissionKeys = ["overview", "bookings", "roomStatus", "invoices", "reports", "staff"];
const tone: Record<string, string> = { blue: "bg-blue-100 text-blue-700", amber: "bg-amber-100 text-amber-700", emerald: "bg-emerald-100 text-emerald-700" };

export default function PermissionsWorkspace() {
  const { t } = useTranslation();
  const [matrix, setMatrix] = useState(roles.map((role) => role.permissions));
  const [saved, setSaved] = useState(false);
  const toggle = (roleIndex: number, permissionIndex: number) => { setSaved(false); setMatrix((current) => current.map((row, index) => index === roleIndex ? row.map((value, item) => item === permissionIndex ? !value : value) : row)); };
  return <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><ShieldCheck size={18} className="text-blue-600" /><h3 className="font-bold text-slate-900">{t("permission.accessTitle")}</h3></div><p className="mt-1 text-sm text-slate-500">{t("permission.accessDescription")}</p></div><button onClick={() => setSaved(true)} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"><Save size={16} />{saved ? t("permission.saved") : t("permission.save")}</button></div>
    <div className="border-b border-slate-100 bg-blue-50/50 p-4"><div className="flex items-start gap-3"><LockKeyhole size={17} className="mt-0.5 text-blue-600" /><p className="text-xs leading-5 text-blue-900">{t("permission.notice")}</p></div></div>
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-212.5 text-left"><thead className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400"><tr><th className="w-56 px-5 py-4">{t("permission.role")}</th>{permissionKeys.map((key) => <th key={key} className="px-3 py-4 text-center">{t(`permission.permissions.${key}`)}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{roles.map((role, roleIndex) => <tr key={role.key} className="hover:bg-slate-50/60"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${tone[role.tone]}`}><UserRound size={16} /></span><span><p className="text-xs font-bold text-slate-800">{t(`permission.roles.${role.key}.name`)}</p><p className="mt-1 text-[10px] text-slate-400">{t(`permission.roles.${role.key}.description`)}</p></span></div></td>{role.permissions.map((_, permissionIndex) => <td key={permissionIndex} className="px-3 py-4 text-center"><button onClick={() => toggle(roleIndex, permissionIndex)} className={`mx-auto grid h-7 w-7 place-items-center rounded-lg ${matrix[roleIndex][permissionIndex] ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300"}`} aria-label={`${t(`permission.roles.${role.key}.name`)}: ${t(`permission.permissions.${permissionKeys[permissionIndex]}`)}`}><Check size={15} /></button></td>)}</tr>)}</tbody></table></div>
    <div className="space-y-3 p-4 md:hidden">{roles.map((role, roleIndex) => <div key={role.key} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${tone[role.tone]}`}><UserRound size={16} /></span><div><p className="text-sm font-bold text-slate-800">{t(`permission.roles.${role.key}.name`)}</p><p className="mt-1 text-[10px] text-slate-400">{t(`permission.roles.${role.key}.description`)}</p></div></div><div className="mt-4 grid grid-cols-2 gap-2">{permissionKeys.map((key, permissionIndex) => <button key={key} onClick={() => toggle(roleIndex, permissionIndex)} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] font-semibold ${matrix[roleIndex][permissionIndex] ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400"}`}><Check size={12} />{t(`permission.permissions.${key}`)}</button>)}</div></div>)}</div>
  </section>;
}
