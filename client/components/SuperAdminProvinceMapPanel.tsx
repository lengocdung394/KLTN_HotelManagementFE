import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { SuperAdminBranch } from "../services/superAdminApi";

type ProvinceMapEntry = {
  name: string;
  x: number;
  y: number;
  aliases: string[];
};

const normalizeProvinceName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/^(tinh|thanh pho|tp)\s*/i, "")
    .replace(/[^a-z0-9]/g, "");

const provinces: ProvinceMapEntry[] = [
  { name: "Lai Châu", x: 92, y: 125, aliases: [] },
  { name: "Điện Biên", x: 85, y: 154, aliases: [] },
  { name: "Lào Cai", x: 145, y: 137, aliases: ["Yên Bái"] },
  { name: "Tuyên Quang", x: 178, y: 117, aliases: ["Hà Giang"] },
  { name: "Cao Bằng", x: 223, y: 105, aliases: [] },
  { name: "Sơn La", x: 133, y: 178, aliases: [] },
  { name: "Lạng Sơn", x: 248, y: 147, aliases: [] },
  { name: "Thái Nguyên", x: 212, y: 139, aliases: ["Bắc Kạn"] },
  { name: "Phú Thọ", x: 189, y: 186, aliases: ["Vĩnh Phúc", "Hòa Bình"] },
  { name: "Bắc Ninh", x: 240, y: 171, aliases: ["Bắc Giang"] },
  { name: "Quảng Ninh", x: 280, y: 175, aliases: [] },
  { name: "Hà Nội", x: 208, y: 187, aliases: [] },
  { name: "Hải Phòng", x: 245, y: 191, aliases: ["Hải Dương"] },
  { name: "Hưng Yên", x: 233, y: 204, aliases: ["Thái Bình"] },
  { name: "Ninh Bình", x: 222, y: 219, aliases: ["Nam Định", "Hà Nam"] },
  { name: "Thanh Hóa", x: 189, y: 232, aliases: [] },
  { name: "Nghệ An", x: 171, y: 269, aliases: [] },
  { name: "Hà Tĩnh", x: 207, y: 314, aliases: [] },
  { name: "Quảng Trị", x: 243, y: 363, aliases: ["Quảng Bình"] },
  { name: "Thành phố Huế", x: 288, y: 406, aliases: ["Thừa Thiên Huế", "Huế"] },
  { name: "Thành phố Đà Nẵng", x: 308, y: 438, aliases: ["Quảng Nam", "Đà Nẵng"] },
  { name: "Quảng Ngãi", x: 315, y: 479, aliases: ["Kon Tum"] },
  { name: "Gia Lai", x: 329, y: 519, aliases: ["Bình Định"] },
  { name: "Đắk Lắk", x: 329, y: 565, aliases: ["Phú Yên"] },
  { name: "Khánh Hòa", x: 353, y: 605, aliases: ["Ninh Thuận"] },
  { name: "Lâm Đồng", x: 308, y: 624, aliases: ["Đắk Nông", "Bình Thuận"] },
  { name: "Đồng Nai", x: 265, y: 635, aliases: ["Bình Phước"] },
  { name: "Tây Ninh", x: 226, y: 653, aliases: ["Long An"] },
  { name: "Thành phố Hồ Chí Minh", x: 256, y: 663, aliases: ["Bình Dương", "Bà Rịa - Vũng Tàu", "Bà Rịa Vũng Tàu", "TP. Hồ Chí Minh", "TP HCM", "HCM", "Hồ Chí Minh"] },
  { name: "Đồng Tháp", x: 213, y: 679, aliases: ["Tiền Giang"] },
  { name: "An Giang", x: 175, y: 693, aliases: ["Kiên Giang"] },
  { name: "Thành phố Cần Thơ", x: 208, y: 714, aliases: ["Hậu Giang", "Sóc Trăng", "Cần Thơ"] },
  { name: "Vĩnh Long", x: 232, y: 702, aliases: ["Bến Tre", "Trà Vinh"] },
  { name: "Cà Mau", x: 182, y: 742, aliases: ["Bạc Liêu"] },
];

const provinceNamesByAlias = new Map(
  provinces.flatMap((province) =>
    [province.name, ...province.aliases].map((name) => [normalizeProvinceName(name), province.name] as const),
  ),
);

export default function SuperAdminProvinceMapPanel({
  branches,
  isLoading,
}: {
  branches: SuperAdminBranch[];
  isLoading: boolean;
}) {
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const branchCounts = useMemo(() => {
    const counts = new Map(provinces.map(({ name }) => [name, 0]));
    branches.forEach((branch) => {
      if (!branch.provinceName) return;
      const provinceName = provinceNamesByAlias.get(normalizeProvinceName(branch.provinceName));
      if (provinceName) counts.set(provinceName, (counts.get(provinceName) ?? 0) + 1);
    });
    return counts;
  }, [branches]);
  const branchPins = useMemo(() => {
    const branchIndexesByProvince = new Map<string, number>();
    return branches.flatMap((branch) => {
      if (!branch.provinceName || !branch.address?.trim()) return [];
      const provinceName = provinceNamesByAlias.get(normalizeProvinceName(branch.provinceName));
      const province = provinceName ? provinces.find((item) => item.name === provinceName) : undefined;
      if (!provinceName || !province) return [];

      const index = branchIndexesByProvince.get(provinceName) ?? 0;
      branchIndexesByProvince.set(provinceName, index + 1);
      const angle = index * 2.4;
      const radius = index === 0 ? 0 : 9 + Math.floor(index / 6) * 5;

      return [{
        branch,
        provinceName,
        x: province.x + Math.cos(angle) * radius,
        y: province.y + Math.sin(angle) * radius,
      }];
    });
  }, [branches]);
  const coveredProvinceCount = provinces.filter(({ name }) => (branchCounts.get(name) ?? 0) > 0).length;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-bold text-slate-900">Phân bố chi nhánh theo tỉnh/thành</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isLoading
              ? "Đang cập nhật dữ liệu chi nhánh..."
              : `${coveredProvinceCount}/34 tỉnh/thành có chi nhánh · ${branches.length} chi nhánh toàn hệ thống`}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
          <MapPin size={14} />
          Bản đồ toàn quốc
        </span>
      </header>

      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:gap-6 lg:p-6">
        <div className="mx-auto w-full max-w-[390px] space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/70">
            <img
              src="/province-covers/vietnam-34-provinces.svg"
              alt="Bản đồ 34 tỉnh thành Việt Nam"
              className="block h-auto w-full"
            />
            <svg viewBox="0 0 420 850" className="absolute inset-0 h-full w-full" role="img" aria-label="Vị trí chi nhánh theo tỉnh thành">
              {provinces.map((province) => {
                const count = branchCounts.get(province.name) ?? 0;
                const isSelected = selectedProvince === province.name;
                const hasAddressPin = branchPins.some((pin) => pin.provinceName === province.name);
                return (
                  <g
                    key={province.name}
                    role="button"
                    tabIndex={0}
                    aria-label={`${province.name}: ${count} chi nhánh`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedProvince((current) => current === province.name ? null : province.name)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedProvince((current) => current === province.name ? null : province.name);
                      }
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <title>{`${province.name}: ${count} chi nhánh`}</title>
                    {isSelected && <circle cx={province.x} cy={province.y} r="15" fill="#2563eb" fillOpacity="0.16" />}
                    {(!hasAddressPin || count === 0) && (
                      <circle
                        cx={province.x}
                        cy={province.y}
                        r={isSelected ? 7 : count > 0 ? 5 : 3.5}
                        fill={count > 0 ? "#2563eb" : "#94a3b8"}
                        stroke="white"
                        strokeWidth="2"
                        className="transition-all"
                      />
                    )}
                  </g>
                );
              })}
              {branchPins.map(({ branch, provinceName, x, y }) => (
                <g
                  key={branch.id}
                  transform={`translate(${x - 12} ${y - 22})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${branch.name}, ${branch.address}, ${provinceName}`}
                  onClick={() => setSelectedProvince(provinceName)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedProvince(provinceName);
                    }
                  }}
                  className="cursor-pointer drop-shadow-sm outline-none"
                >
                  <title>{`${branch.name} · ${branch.address} · ${provinceName}`}</title>
                  <path
                    d="M12 22s8-4.5 8-11a8 8 0 1 0-16 0c0 6.5 8 11 8 11Z"
                    fill="#1d4ed8"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  <circle cx="12" cy="11" r="3" fill="white" />
                </g>
              ))}
            </svg>
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
              <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="fill-blue-600 text-blue-700" />Chi nhánh có địa chỉ</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" />Chưa có</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] font-medium text-slate-600 sm:grid-cols-4">
            <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-blue-300" />Miền Bắc</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-cyan-300" />Bắc Trung Bộ</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-amber-300" />Miền Trung &amp; Tây Nguyên</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-violet-300" />Miền Nam</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-800">34 tỉnh/thành</h3>
            {selectedProvince && (
              <button
                type="button"
                onClick={() => setSelectedProvince(null)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Bỏ chọn
              </button>
            )}
          </div>
          <ul className="grid max-h-[440px] grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {provinces.map(({ name }) => {
              const count = branchCounts.get(name) ?? 0;
              const isSelected = selectedProvince === name;
              return (
                <li key={name}>
                  <button
                    type="button"
                    onClick={() => setSelectedProvince((current) => current === name ? null : name)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      isSelected ? "bg-blue-100 text-blue-900 ring-1 ring-blue-200" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${count > 0 ? "bg-blue-600" : "bg-slate-300"}`} />
                      <span className="truncate font-medium text-slate-700" title={name}>{name}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold tabular-nums ${
                      count > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {count} chi nhánh
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            Địa chỉ chưa có tọa độ GPS nên ghim được đặt gần trung tâm tỉnh/thành, không phải vị trí chính xác của khách sạn.
          </p>
        </div>
      </div>
    </section>
  );
}
