import axios from "axios";
import axiosClient from "../store/axiosClient";

export type StartRoomImportResponse = {
  message?: string;
  taskId: string;
};

export type RoomImportTaskStatus = Record<string, unknown> & {
  taskId?: string;
  status?: string;
  message?: string;
  percent?: number;
  percentage?: number;
  progress?: number;
  completed?: boolean;
  data?: unknown[];
  details?: unknown[];
};

export const getRoomImportErrorMessage = (error: unknown) => {
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
  return error instanceof Error ? error.message : "Không thể nhập phòng.";
};

export const startRoomImport = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await axiosClient.post<StartRoomImportResponse>("/roomsExcel/importRooms", formData);
  if (!response.data?.taskId) {
    throw new Error(response.data?.message || "Máy chủ không trả về mã tiến trình nhập phòng.");
  }
  return { taskId: response.data.taskId, message: response.data.message };
};

export const getRoomImportStatus = async (taskId: string, signal?: AbortSignal) => {
  const response = await axiosClient.get<RoomImportTaskStatus>(
    `/roomsExcel/status/${encodeURIComponent(taskId)}`,
    { signal },
  );
  if (!response.data || typeof response.data !== "object") {
    throw new Error("Phản hồi trạng thái nhập phòng không hợp lệ.");
  }
  return response.data;
};

export const isRoomImportFinished = (status: RoomImportTaskStatus) =>
  status.completed === true ||
  ["COMPLETED", "COMPLETE", "SUCCESS", "SUCCEEDED", "FAILED", "ERROR", "DONE"]
    .includes(String(status.status ?? "").trim().toUpperCase());
