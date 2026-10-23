import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Filter, Pencil, Plus, Search, Upload, UserRound, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { uploadEmployeeImageToCloudinary, uploadImagesToCloudinary } from "../services/cloudinaryUploadApi";
import {
  useCreateEmployeeMutation,
  useGetMyHotelEmployeesQuery,
  useUpdateEmployeeMutation,
  type EmployeeRecord,
  type UpdateEmployeeRequest,
} from "../services/employeeApi";
import { useAppSelector } from "../store/hooks";
import BulkImportDialog from "./BulkImportDialog";
import {
  downloadEmployeeTemplate,
  parseEmployeeImportArchive,
  validateEmployeeImportArchive,
  type EmployeeImportRowResult,
} from "../lib/employeeBulkImport";
import { localizedText } from "../i18n";

const MAX_EMPLOYEE_IMAGE_BYTES = 5 * 1024 * 1024;
const EMPLOYEE_ROLES = ["Lễ tân", "Buồng phòng", "Bảo vệ"] as const;
const employeeRoleLabel = (role: string) => role === "Lễ tân"
  ? localizedText(role, "Front desk")
  : role === "Buồng phòng"
    ? localizedText(role, "Housekeeping")
    : role === "Bảo vệ"
      ? localizedText(role, "Security")
      : role;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = error.data;
    if (typeof data === "object" && data !== null && "message" in data && typeof data.message === "string") {
      return data.message;
    }
  }
  return localizedText("Không thể tạo nhân viên. Vui lòng kiểm tra thông tin hoặc thử lại.", "Could not create employee. Check the information and try again.");
};

const getInitials = (fullName: string) =>
  fullName.trim().split(/\s+/).map((part) => part[0]).slice(-2).join("").toUpperCase();

const getEditablePosition = (position: string) => {
  if (position === "Housekeeping") return "Buồng phòng";
  if (position === "Receptionist") return "Lễ tân";
  if (position === "Security") return "Bảo vệ";
  return EMPLOYEE_ROLES.includes(position as typeof EMPLOYEE_ROLES[number]) ? position : EMPLOYEE_ROLES[0];
};

const isBranchManagerOrAdmin = (roles: string[], position: string | null) =>
  roles.includes("ROLE_MANAGER")
  || roles.includes("ROLE_ADMIN")
  || position === "Quản lý chi nhánh"
  || position === "Admin chi nhánh";

const isEditableEmployee = (employee: EmployeeRecord) => {
  if (employee.roleCodes) return employee.roleCodes.includes("ROLE_EMPLOYEE");
  if (employee.roles.includes("ROLE_EMPLOYEE")) return true;
  return [
    "Lễ tân",
    "Buồng phòng",
    "Bảo vệ",
    "Receptionist",
    "Housekeeping",
    "Security",
  ].includes(employee.position);
};

export default function EmployeeDirectory() {
  const { hotelId, hotelName, roles, position } = useAppSelector((state) => state.auth);
  const numericHotelId = hotelId ? Number(hotelId) : NaN;
  const hasHotelId = Number.isSafeInteger(numericHotelId) && numericHotelId > 0;
  const { data: employees = [], isLoading, isError, error } = useGetMyHotelEmployeesQuery();
  const [createEmployee, { isLoading: isSaving }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdatingEmployee }] = useUpdateEmployeeMutation();
  const canManageBranchEmployees = isBranchManagerOrAdmin(roles, position);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const addEmployeeInProgress = useRef(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Lễ tân");
  const [email, setEmail] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [importRows, setImportRows] = useState<EmployeeImportRowResult[]>([]);
  const [detailEmployee, setDetailEmployee] = useState<EmployeeRecord | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  const [editForm, setEditForm] = useState<UpdateEmployeeRequest>({
    fullName: "",
    email: "",
    phone: "",
    cccd: "",
    address: "",
    position: EMPLOYEE_ROLES[0],
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [editError, setEditError] = useState("");
  const filteredEmployees = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return employees.filter((employee) => {
      const matchesPosition = positionFilter === "all" || getEditablePosition(employee.position) === positionFilter;
      if (!matchesPosition) return false;
      if (!normalizedQuery) return true;
      return [
        employee.fullName,
        employee.email,
        employee.phone,
        employee.cccd,
        employee.position,
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [employees, positionFilter, searchQuery]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const resetForm = () => {
    setName("");
    setRole("Lễ tân");
    setEmail("");
    setIdentityNumber("");
    setPhone("");
    setAddress("");
    setImageFile(null);
    setImagePreview("");
    setSaveError("");
  };

  const closeForm = () => {
    if (isAddingEmployee || isSaving) return;
    setAddOpen(false);
    resetForm();
  };

  const selectImage = (file: File | undefined) => {
    setSaveError("");
    if (!file) {
      setImageFile(null);
      setImagePreview("");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageFile(null);
      setImagePreview("");
      setSaveError("Ảnh nhân viên chỉ chấp nhận định dạng JPG, PNG hoặc WebP.");
      return;
    }
    if (file.size > MAX_EMPLOYEE_IMAGE_BYTES) {
      setImageFile(null);
      setImagePreview("");
      setSaveError("Ảnh nhân viên không được vượt quá 5 MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addEmployeeInProgress.current) return;
    if (!hasHotelId) {
      setSaveError("Không xác định được chi nhánh làm việc. Vui lòng đăng nhập lại hoặc liên hệ quản trị viên.");
      return;
    }
    if (!imageFile) {
      setSaveError("Vui lòng chọn ảnh nhân viên.");
      return;
    }
    addEmployeeInProgress.current = true;
    setIsAddingEmployee(true);
    setSaveError("");
    try {
      const avatarUrl = await uploadEmployeeImageToCloudinary(imageFile, hotelName || `chi-nhanh-${numericHotelId}`);
      await createEmployee({
        fullName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        cccd: identityNumber.trim(),
        address: address.trim(),
        position: role,
        hotelId: numericHotelId,
        avatarUrl,
      }).unwrap();
      toast({ title: "Đã thêm nhân viên", description: `${name.trim()} đã được thêm vào danh sách. Mật khẩu tài khoản mặc định là 1111.` });
      setAddOpen(false);
      resetForm();
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      addEmployeeInProgress.current = false;
      setIsAddingEmployee(false);
    }
  };

  const importEmployeesFromFile = async (archiveFile: File) => {
    if (!hasHotelId) throw new Error("Không xác định được chi nhánh làm việc.");

    setImportProgress("Đang kiểm tra file Excel và ảnh...");
    setImportRows([]);
    try {
      const validation = await validateEmployeeImportArchive(archiveFile, employees);
      setImportRows(validation.rows);
      if (!validation.validCount) {
        setImportProgress("");
        return true;
      }
      const parsed = await parseEmployeeImportArchive(archiveFile);
      const validRowNumbers = new Set(validation.rows.filter((row) => row.passed).map((row) => row.rowNumber));
      const validEmployees = parsed.employees.filter((employee) => validRowNumbers.has(employee.rowNumber));
      const imageFilesByName = new Map<string, File>();
      validEmployees.forEach((employee) => {
        const imageName = employee.imageFileName.toLocaleLowerCase();
        const imageMatches = parsed.images.get(imageName) ?? [];
        if (imageMatches.length !== 1) {
          throw new Error(`Không thể xác định duy nhất ảnh "${employee.imageFileName}" ở dòng ${employee.rowNumber}.`);
        }
        imageFilesByName.set(imageName, imageMatches[0]);
      });

      const branchName = hotelName || `chi-nhanh-${numericHotelId}`;
      const imageFiles = [...imageFilesByName.values()];
      setImportProgress(`Đang tải ${imageFiles.length} ảnh lên Cloudinary...`);
      const imageUrls = await uploadImagesToCloudinary(imageFiles, branchName, "employees", (uploaded, total) => {
        setImportProgress(`Đang tải ảnh nhân viên lên Cloudinary: ${uploaded}/${total}...`);
      });

      const resultsByRow = new Map(validation.rows.map((row) => [row.rowNumber, row]));
      for (let index = 0; index < validEmployees.length; index += 1) {
        const employee = validEmployees[index];
        setImportProgress(`Đang tạo nhân viên ${index + 1}/${validEmployees.length}: ${employee.fullName}...`);
        try {
          const avatarUrl = imageUrls.get(employee.imageFileName.toLocaleLowerCase());
          if (!avatarUrl) throw new Error(`Không tìm thấy URL ảnh Cloudinary cho "${employee.imageFileName}".`);
          await createEmployee({
            fullName: employee.fullName,
            email: employee.email,
            phone: employee.phone,
            cccd: employee.cccd,
            address: employee.address,
            position: getEditablePosition(employee.position),
            hotelId: numericHotelId,
            avatarUrl,
          }).unwrap();
          resultsByRow.set(employee.rowNumber, {
            rowNumber: employee.rowNumber,
            fullName: employee.fullName,
            passed: true,
            message: "Đã tạo tài khoản thành công.",
          });
        } catch (error) {
          resultsByRow.set(employee.rowNumber, {
            rowNumber: employee.rowNumber,
            fullName: employee.fullName,
            passed: false,
            message: getErrorMessage(error),
          });
        }
        setImportRows([...resultsByRow.values()].sort((first, second) => first.rowNumber - second.rowNumber));
      }

      const results = [...resultsByRow.values()];
      const createdCount = results.filter((row) => row.passed).length;
      const failedCount = results.filter((row) => !row.passed).length;
      setImportProgress("");
      toast({
        variant: createdCount > 0 ? "checkin" : "destructive",
        title: createdCount > 0 ? "Hoàn tất nhập nhân viên" : "Không thể thêm nhân viên",
        description: `${createdCount} nhân viên được tạo thành công, ${failedCount} dòng cần xem lại. Tài khoản mới dùng mật khẩu mặc định 1111.`,
      });
      return true;
    } catch (error) {
      setImportProgress("");
      throw error;
    }
  };

  const openEditEmployee = (employee: EmployeeRecord) => {
    setDetailEmployee(null);
    setEditingEmployee(employee);
    setEditForm({
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      cccd: employee.cccd,
      address: employee.address,
      position: employee.position,
    });
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setEditError("");
  };

  const saveEmployeeChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingEmployee) return;
    if (newPassword && newPassword.length < 8) {
      setEditError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setEditError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setEditError("");
    try {
      await updateEmployee({
        id: editingEmployee.id,
        staffInfo: {
          ...editForm,
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          cccd: editForm.cccd.trim(),
          address: editForm.address.trim(),
          ...(newPassword ? { password: newPassword } : {}),
        },
      }).unwrap();
      toast({
        title: "Đã cập nhật tài khoản nhân viên",
        description: newPassword
          ? `Đã lưu thay đổi hồ sơ và đặt mật khẩu mới cho ${editForm.fullName.trim()}.`
          : `Đã lưu thay đổi hồ sơ của ${editForm.fullName.trim()}.`,
      });
      setEditingEmployee(null);
    } catch (error) {
      setEditError(getErrorMessage(error));
    }
  };

  return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><UserRound size={18} className="text-blue-600" /><h3 className="font-bold text-slate-900">{localizedText("Danh sách nhân viên", "Employee directory")}</h3></div>
          <p className="mt-1 text-sm text-slate-500">
            {searchQuery || positionFilter !== "all"
              ? localizedText(`Hiển thị ${filteredEmployees.length}/${employees.length} nhân viên.`, `Showing ${filteredEmployees.length}/${employees.length} employees.`)
              : localizedText(`${employees.length} nhân viên đang làm việc tại chi nhánh.`, `${employees.length} employees work at this branch.`)}
          </p>
        </div>
        {canManageBranchEmployees && <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsBulkImportOpen(true)} className="flex w-fit items-center gap-2 rounded-lg border border-blue-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Upload size={15} />{localizedText("Thêm bằng Excel", "Import from Excel")}</button>
          <button type="button" onClick={() => setAddOpen(true)} className="flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"><Plus size={15} />{localizedText("Thêm nhân viên", "Add employee")}</button>
        </div>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={localizedText("Tìm theo tên, email, SĐT hoặc CCCD...", "Search by name, email, phone, or ID number...")}
            aria-label={localizedText("Tìm nhân viên", "Search employees")}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="relative block">
          <Filter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={positionFilter}
            onChange={(event) => setPositionFilter(event.target.value)}
            aria-label={localizedText("Lọc theo chức vụ", "Filter by position")}
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">{localizedText("Tất cả chức vụ", "All positions")}</option>
            {EMPLOYEE_ROLES.map((employeeRole) => <option key={employeeRole} value={employeeRole}>{employeeRoleLabel(employeeRole)}</option>)}
          </select>
        </label>
      </div>
    </div>
    {addOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={closeForm}><form onSubmit={addEmployee} onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between border-b border-slate-100 pb-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{localizedText("Nhân viên", "Employee")}</p><h3 className="mt-1 text-xl font-bold text-slate-900">{localizedText("Thêm nhân viên", "Add employee")}</h3><p className="mt-1 text-sm text-slate-500">{localizedText("Ảnh được tải trực tiếp từ trình duyệt lên Cloudinary theo thư mục chi nhánh.", "Photos are uploaded directly from the browser to the branch folder in Cloudinary.")}</p></div><button type="button" onClick={closeForm} disabled={isAddingEmployee || isSaving} className="text-2xl leading-none text-slate-400 disabled:opacity-50" aria-label={localizedText("Đóng", "Close")}><X size={20} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 sm:col-span-2">{localizedText("Ảnh nhân viên", "Employee photo")} <span className="text-red-500">*</span><input type="file" accept="image/jpeg,image/png,image/webp" required disabled={isAddingEmployee || isSaving} onChange={(event) => selectImage(event.target.files?.[0])} className="mt-1.5 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-blue-700" />{imagePreview && <img src={imagePreview} alt={localizedText("Xem trước ảnh nhân viên", "Employee photo preview")} className="mt-3 h-24 w-24 rounded-xl object-cover" />}</label><label className="text-sm font-semibold text-slate-700">{localizedText("Họ và tên", "Full name")} <span className="text-red-500">*</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={localizedText("Nhập họ và tên", "Enter full name")} required autoFocus disabled={isAddingEmployee || isSaving} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label><label className="text-sm font-semibold text-slate-700">{localizedText("Chức vụ", "Position")} <span className="text-red-500">*</span><select value={role} onChange={(event) => setRole(event.target.value)} required disabled={isAddingEmployee || isSaving} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal"><option value={EMPLOYEE_ROLES[0]}>{employeeRoleLabel(EMPLOYEE_ROLES[0])}</option><option value={EMPLOYEE_ROLES[1]}>{employeeRoleLabel(EMPLOYEE_ROLES[1])}</option><option value={EMPLOYEE_ROLES[2]}>{employeeRoleLabel(EMPLOYEE_ROLES[2])}</option></select></label><label className="text-sm font-semibold text-slate-700">Email <span className="text-red-500">*</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@senviet.vn" required disabled={isAddingEmployee || isSaving} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label><label className="text-sm font-semibold text-slate-700">{localizedText("CCCD", "ID number")} <span className="text-red-500">*</span><input value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value)} placeholder={localizedText("Nhập số CCCD", "Enter ID number")} required disabled={isAddingEmployee || isSaving} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label><label className="text-sm font-semibold text-slate-700">{localizedText("Số điện thoại", "Phone number")} <span className="text-red-500">*</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="090 123 4567" required disabled={isAddingEmployee || isSaving} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-blue-400" /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">{localizedText("Địa chỉ", "Address")} <span className="text-red-500">*</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder={localizedText("Nhập địa chỉ hiện tại", "Enter current address")} required rows={3} disabled={isAddingEmployee || isSaving} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-400" /></label></div>{saveError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>}<div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={closeForm} disabled={isAddingEmployee || isSaving} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">{localizedText("Hủy", "Cancel")}</button><button type="submit" disabled={isAddingEmployee || isSaving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isAddingEmployee || isSaving ? localizedText("Đang lưu...", "Saving...") : localizedText("Lưu nhân viên", "Save employee")}</button></div></form></div>}
    {isLoading && <p className="p-5 text-sm text-slate-500">{localizedText("Đang tải danh sách nhân viên...", "Loading employee directory...")}</p>}
    {isError && <p role="alert" className="p-5 text-sm text-red-700">{localizedText("Không thể tải danh sách nhân viên", "Could not load the employee directory")}{typeof error === "object" && error !== null && "status" in error ? ` (HTTP ${String(error.status)})` : ""}{localizedText(". Vui lòng kiểm tra tài khoản chi nhánh hoặc thử tải lại.", ". Check the branch account or try reloading.")}</p>}
    {!isLoading && !isError && <div className="overflow-x-auto">
      {filteredEmployees.length ? <table className="w-full min-w-[560px] border-collapse text-left">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">{localizedText("Tên nhân viên", "Employee name")}</th>
            <th scope="col" className="px-5 py-3 font-semibold">{localizedText("Chức vụ", "Position")}</th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">{localizedText("Thao tác", "Actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredEmployees.map((employee) => <tr key={employee.id} className="hover:bg-slate-50/70">
            <td className="px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {employee.avatarUrl
                  ? <img src={employee.avatarUrl} alt={employee.fullName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  : <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{getInitials(employee.fullName)}</div>}
                <span className="truncate text-sm font-bold text-slate-900">{employee.fullName}</span>
              </div>
            </td>
            <td className="px-5 py-3 text-sm text-slate-600">{employeeRoleLabel(employee.position)}</td>
            <td className="px-5 py-3">
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDetailEmployee(employee)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Eye size={14} />{localizedText("Chi tiết", "Details")}</button>
                {canManageBranchEmployees && isEditableEmployee(employee) && <button type="button" onClick={() => openEditEmployee(employee)} className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Pencil size={14} />{localizedText("Sửa hồ sơ / tài khoản", "Edit profile / account")}</button>}
              </div>
            </td>
          </tr>)}
        </tbody>
      </table> : employees.length
        ? <p className="px-5 py-5 text-sm text-slate-500">{localizedText("Không tìm thấy nhân viên phù hợp. Hãy thử từ khóa hoặc bộ lọc khác.", "No matching employees found. Try another search term or filter.")}</p>
        : <p className="px-5 py-5 text-sm text-slate-500">{localizedText("Chưa có nhân viên nào được ghi nhận tại chi nhánh này.", "No employees have been recorded for this branch yet.")}</p>}
    </div>}
    {importRows.length > 0 && <div className="border-t border-slate-100 p-5"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold text-slate-800">{localizedText("Kết quả nhập file", "Import results")}</h4><span className="text-xs text-slate-500">{importRows.filter((row) => row.passed && row.message === "Đã tạo tài khoản thành công.").length} {localizedText("thành công", "successful")} · {importRows.filter((row) => !row.passed).length} {localizedText("cần kiểm tra", "need review")}</span></div><div className="mt-3 max-h-56 space-y-2 overflow-y-auto">{importRows.map((row) => <div key={row.rowNumber} className={`rounded-lg px-3 py-2 text-xs ${row.passed ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}><span className="font-semibold">{localizedText("Dòng", "Row")} {row.rowNumber} · {row.fullName}:</span> {row.message || localizedText("Hợp lệ.", "Valid.")}</div>)}</div></div>}
    <BulkImportDialog
      open={isBulkImportOpen}
      onOpenChange={setIsBulkImportOpen}
      eyebrow={localizedText("Nhân sự", "Staff")}
      title={localizedText("Thêm nhân viên bằng Excel", "Import employees from Excel")}
      description={localizedText("Tải mẫu, điền hồ sơ nhân viên và đóng gói file Excel cùng thư mục ảnh thành ZIP.", "Download the template, fill in employee details, and package the spreadsheet and image folder in a ZIP file.")}
      templateLabel={localizedText("Tải file Excel mẫu", "Download Excel template")}
      onDownloadTemplate={downloadEmployeeTemplate}
      acceptedFileTypes=".zip,application/zip"
      fileLabel={localizedText("Chọn file ZIP chứa Excel và ảnh nhân viên", "Choose a ZIP file containing the spreadsheet and employee photos")}
      validateFile={(file) => file.name.toLocaleLowerCase().endsWith(".zip") ? null : localizedText("Vui lòng chọn file ZIP chứa file Excel mẫu và thư mục images.", "Choose a ZIP file containing the Excel template and images folder.")}
      instructions={<><p className="font-semibold">{localizedText("Các bước nhập:", "Import steps:")}</p><ol className="mt-1 list-inside list-decimal space-y-1"><li>{localizedText("Giải nén thư mục mẫu, giữ nguyên tên file Excel và các cột.", "Extract the template folder and keep the Excel filename and columns unchanged.")}</li><li>{localizedText("Đặt ảnh JPG, PNG hoặc WebP vào thư mục", "Put JPG, PNG, or WebP photos in the")} <strong>images</strong>{localizedText(", tên ảnh phải khớp với cột Tên file ảnh.", " folder; each filename must match the Image filename column.")}</li><li>{localizedText("Nén file Excel và thư mục images thành ZIP rồi chọn file để nhập.", "Zip the Excel file and images folder, then select the ZIP file to import.")}</li><li>{localizedText("Ảnh được tải trực tiếp từ trình duyệt lên Cloudinary theo chi nhánh; hệ thống chỉ gửi URL ảnh đến máy chủ.", "Photos are uploaded directly from the browser to the branch's Cloudinary folder; only image URLs are sent to the server.")}</li></ol><p className="mt-2">{localizedText("Dòng hợp lệ được tạo độc lập. Mật khẩu mặc định của tài khoản mới là", "Valid rows are created independently. New accounts use the default password")} <strong>1111</strong>.</p></>}
      uploadLabel={localizedText("Kiểm tra và nhập", "Validate and import")}
      progress={importProgress}
      onUpload={importEmployeesFromFile}
    />
    {detailEmployee && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4" onMouseDown={() => setDetailEmployee(null)}><section role="dialog" aria-modal="true" aria-labelledby="employee-detail-title" onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between border-b border-slate-100 pb-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{localizedText("Hồ sơ nhân sự", "Staff profile")}</p><h3 id="employee-detail-title" className="mt-1 text-xl font-bold text-slate-900">{localizedText("Chi tiết nhân viên", "Employee details")}</h3></div><button type="button" onClick={() => setDetailEmployee(null)} aria-label={localizedText("Đóng", "Close")} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div><div className="mt-5 flex items-center gap-4">{detailEmployee.avatarUrl ? <img src={detailEmployee.avatarUrl} alt={detailEmployee.fullName} className="h-20 w-20 rounded-2xl object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-2xl bg-blue-100 text-xl font-bold text-blue-700">{getInitials(detailEmployee.fullName)}</div>}<div><h4 className="text-lg font-bold text-slate-900">{detailEmployee.fullName}</h4><p className="mt-1 text-sm text-blue-700">{employeeRoleLabel(detailEmployee.position)}</p><p className="mt-1 text-xs text-slate-500">{localizedText("Mã nhân viên:", "Employee ID:")} {detailEmployee.id}</p></div></div><dl className="mt-5 grid gap-4 sm:grid-cols-2">{[[localizedText("Email / tài khoản", "Email / account"), detailEmployee.email], [localizedText("Số điện thoại", "Phone number"), detailEmployee.phone], ["CCCD", detailEmployee.cccd], [localizedText("Chi nhánh", "Branch"), detailEmployee.hotelName], [localizedText("Địa chỉ", "Address"), detailEmployee.address]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || localizedText("Chưa cập nhật", "Not provided")}</dd></div>)}</dl><div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => setDetailEmployee(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">{localizedText("Đóng", "Close")}</button>{canManageBranchEmployees && isEditableEmployee(detailEmployee) && <button type="button" onClick={() => openEditEmployee(detailEmployee)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Pencil size={15} />{localizedText("Sửa hồ sơ / tài khoản", "Edit profile / account")}</button>}</div></section></div>}
    {editingEmployee && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4" onMouseDown={() => { if (!isUpdatingEmployee) setEditingEmployee(null); }}>
      <form onSubmit={saveEmployeeChanges} onMouseDown={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{localizedText("Quản lý chi nhánh", "Branch management")}</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{localizedText("Chỉnh sửa nhân viên", "Edit employee")}</h3>
            <p className="mt-1 text-sm text-slate-500">{localizedText("Cập nhật riêng hồ sơ cá nhân và thông tin đăng nhập.", "Update the employee profile and sign-in information separately.")}</p>
          </div>
          <button type="button" disabled={isUpdatingEmployee} onClick={() => setEditingEmployee(null)} aria-label={localizedText("Đóng", "Close")} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>

        <section className="mt-5 rounded-xl border border-slate-200 p-4">
          <div className="mb-4 border-b border-slate-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">{localizedText("Thông tin cá nhân", "Personal information")}</h4>
            <p className="mt-1 text-xs text-slate-500">{localizedText("Thông tin hồ sơ và chức vụ của nhân viên.", "Employee profile and position information.")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">{localizedText("Họ và tên", "Full name")}<input required value={editForm.fullName} disabled={isUpdatingEmployee} onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">{localizedText("Chức vụ", "Position")}<select required value={editForm.position} disabled={isUpdatingEmployee} onChange={(event) => setEditForm((current) => ({ ...current, position: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal">{EMPLOYEE_ROLES.map((position) => <option key={position} value={position}>{employeeRoleLabel(position)}</option>)}</select></label>
            <label className="text-sm font-semibold text-slate-700">{localizedText("Số điện thoại", "Phone number")}<input required value={editForm.phone} disabled={isUpdatingEmployee} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">{localizedText("CCCD", "ID number")}<input required value={editForm.cccd} disabled={isUpdatingEmployee} onChange={(event) => setEditForm((current) => ({ ...current, cccd: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">{localizedText("Địa chỉ", "Address")}<textarea required rows={2} value={editForm.address} disabled={isUpdatingEmployee} onChange={(event) => setEditForm((current) => ({ ...current, address: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" /></label>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <div className="mb-4 border-b border-blue-100 pb-3">
            <h4 className="text-sm font-bold text-slate-900">{localizedText("Thông tin tài khoản", "Account information")}</h4>
            <p className="mt-1 text-xs text-slate-500">{localizedText("Email dùng để đăng nhập. Để trống mật khẩu nếu không muốn đổi.", "Email is used to sign in. Leave the password blank to keep it unchanged.")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">{localizedText("Email / tài khoản", "Email / account")}<input required type="email" value={editForm.email} disabled={isUpdatingEmployee} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal" /></label>
            <label className="text-sm font-semibold text-slate-700">{localizedText("Mật khẩu mới", "New password")}<span className="relative mt-1.5 block"><input type={showNewPassword ? "text" : "password"} autoComplete="new-password" minLength={8} value={newPassword} disabled={isUpdatingEmployee} onChange={(event) => setNewPassword(event.target.value)} placeholder={localizedText("Để trống nếu không đổi", "Leave blank to keep unchanged")} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 pr-11 text-sm font-normal" /><button type="button" disabled={isUpdatingEmployee} onClick={() => setShowNewPassword((visible) => !visible)} aria-label={showNewPassword ? localizedText("Ẩn mật khẩu mới", "Hide new password") : localizedText("Hiện mật khẩu mới", "Show new password")} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-500 hover:text-blue-700">{showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            <label className="text-sm font-semibold text-slate-700">{localizedText("Xác nhận mật khẩu mới", "Confirm new password")}<span className="relative mt-1.5 block"><input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} disabled={isUpdatingEmployee} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={localizedText("Nhập lại mật khẩu mới", "Re-enter new password")} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 pr-11 text-sm font-normal" /><button type="button" disabled={isUpdatingEmployee} onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? localizedText("Ẩn mật khẩu xác nhận", "Hide password confirmation") : localizedText("Hiện mật khẩu xác nhận", "Show password confirmation")} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-500 hover:text-blue-700">{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          </div>
        </section>

        {editError && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p>}
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" disabled={isUpdatingEmployee} onClick={() => setEditingEmployee(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">{localizedText("Hủy", "Cancel")}</button>
          <button type="submit" disabled={isUpdatingEmployee} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isUpdatingEmployee ? localizedText("Đang lưu...", "Saving...") : localizedText("Lưu thay đổi", "Save changes")}</button>
        </div>
      </form>
    </div>}
  </section>;
}
