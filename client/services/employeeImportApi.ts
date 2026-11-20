import axiosClient from "../store/axiosClient";

export type EmployeeImportTaskStatus = {
  taskId?: string;
  percent?: number;
  progressPercentage?: number;
  percentage?: number;
  progress?: number;
  processedCount?: number;
  processed?: number;
  totalCount?: number;
  total?: number;
  message?: string;
  status?: string;
};

type EmployeeImportResponse = {
  success: boolean;
  taskId: string;
  message?: string;
};

export const startEmployeeImport = async (
  employees: Array<{
    fullName: string;
    email: string;
    phone: string;
    cccd: string;
    address: string;
    position: string;
    avatarUrl: string;
  }>,
  signal?: AbortSignal,
) => {
  const response = await axiosClient.post<EmployeeImportResponse>(
    "/employee/import-urls-async",
    { employees },
  );
  if (!response.data.success || !response.data.taskId) {
    throw new Error(response.data.message || "Máy chủ không trả về mã tiến trình nhập nhân viên.");
  }
  return response.data.taskId;
};

export const getEmployeeImportStatus = async (
  taskId: string,
  signal?: AbortSignal,
): Promise<EmployeeImportTaskStatus> => {
  const response = await axiosClient.get<EmployeeImportTaskStatus>(
    `/employee/import-status/${encodeURIComponent(taskId)}`,
    { signal },
  );
  if (!response.data || typeof response.data.status !== "string") {
    throw new Error("Phản hồi trạng thái nhập nhân viên không hợp lệ.");
  }
  return response.data;
};

export const isEmployeeImportFinished = (status: EmployeeImportTaskStatus) =>
  ["SUCCESS", "COMPLETED", "COMPLETE", "FAILED", "ERROR", "NOT_FOUND"]
    .includes(status.status?.toUpperCase() ?? "");
