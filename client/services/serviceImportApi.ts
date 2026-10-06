import axios from "axios";
import axiosClient from "../store/axiosClient";

export type ServiceImportRequest = {
  services: Array<{
    rowNumber: number;
    name: string;
    description: string;
    price: number;
    unit: string;
    category: string;
    imageUrl: string;
  }>;
};

type StartServiceImportResponse = {
  success: boolean;
  taskId: string;
  message?: string;
};

export type ServiceImportTaskStatus = {
  taskId?: string;
  status: string;
  message?: string;
  percent?: number;
  progress?: number;
  percentage?: number;
  progressPercentage?: number;
  processed?: number;
  processedCount?: number;
  successCount?: number;
  importedCount?: number;
  total?: number;
  totalCount?: number;
  completed?: boolean;
};

export const getServiceImportErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data;
    if (
      typeof responseData === "object" &&
      responseData !== null &&
      "message" in responseData &&
      typeof responseData.message === "string"
    ) {
      return responseData.message;
    }
  }
  return error instanceof Error ? error.message : "Không thể nhập dịch vụ.";
};

export const startServiceImport = async (request: ServiceImportRequest) => {
  const response = await axiosClient.post<StartServiceImportResponse>(
    "/servicesImport/import-urls-async",
    request,
  );
  if (!response.data.success || !response.data.taskId) {
    throw new Error(response.data.message || "Máy chủ không trả về mã tiến trình nhập.");
  }
  return response.data.taskId;
};

export const getServiceImportStatus = async (taskId: string, signal?: AbortSignal) => {
  const response = await axiosClient.get<ServiceImportTaskStatus>(
    `/servicesImport/import-status/${encodeURIComponent(taskId)}`,
    { signal },
  );
  if (!response.data || typeof response.data.status !== "string") {
    throw new Error("Phản hồi trạng thái nhập dịch vụ không hợp lệ.");
  }
  return response.data;
};

export const isServiceImportFinished = (status: ServiceImportTaskStatus) =>
  status.completed === true ||
  ["COMPLETED", "COMPLETE", "SUCCESS", "SUCCEEDED", "FAILED", "ERROR", "DONE"]
    .includes(status.status.trim().toUpperCase());

export const isServiceImportFailed = (status: ServiceImportTaskStatus) =>
  ["FAILED", "ERROR"].includes(status.status.trim().toUpperCase());
