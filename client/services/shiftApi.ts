import { baseApi } from "./baseApi";

export type ShiftAssignment = {
  id?: string;
  employeeId: string;
  workDate: string;
  employeeName: string;
  position: string;
  shiftType: string;
  shiftTime: string;
  role: string;
  task: string;
};

export type DailyShiftSummary = {
  date: string;
  dayKey: string;
  dayLabel: string;
  dateDisplay: string;
  fullyStaffed: boolean;
  totalAssigned: number;
  assignments: ShiftAssignment[];
};

export type WeeklyShiftSchedule = {
  hotelId: number;
  weekStartDate: string;
  weekEndDate: string;
  daysFullyStaffed: number;
  totalAssignments: number;
  totalUniqueStaff: number;
  days: DailyShiftSummary[];
};

export type ShiftAssignmentRequest = {
  workDate: string;
  shiftType: string;
  shiftTime: string;
  role: string;
  employeeId: string;
  task: string;
};

export type HousekeepingTask = {
  id: string;
  roomId: string;
  roomNumber: string;
  bookingDetailId: string;
  status: "ASSIGNED" | "REASSIGNED" | string;
  createdAt: string;
  assignedAt: string | null;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
};

type ApiResponse<T> = {
  result: T;
};

export const shiftApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTodayShiftAssignments: builder.query<ShiftAssignment[], void>({
      query: () => ({ url: "/staff-shifts/today", method: "GET" }),
      transformResponse: (response: ApiResponse<ShiftAssignment[]>) => response.result,
      providesTags: ["Staff"],
    }),
    getWeeklyShiftSchedule: builder.query<WeeklyShiftSchedule, string>({
      query: (weekStartDate) => ({
        url: "/staff-shifts/weekly",
        method: "GET",
        params: { weekStartDate },
      }),
      transformResponse: (response: ApiResponse<WeeklyShiftSchedule>) => response.result,
      providesTags: ["Staff"],
    }),
    saveWeeklyShiftSchedule: builder.mutation<
      WeeklyShiftSchedule,
      { weekStartDate: string; assignments: ShiftAssignmentRequest[] }
    >({
      query: ({ weekStartDate, assignments }) => ({
        url: "/staff-shifts/weekly",
        method: "PUT",
        params: { weekStartDate },
        data: { assignments },
      }),
      transformResponse: (response: ApiResponse<WeeklyShiftSchedule>) => response.result,
      invalidatesTags: ["Staff"],
    }),
    clearWeeklyShiftSchedule: builder.mutation<WeeklyShiftSchedule, string>({
      query: (weekStartDate) => ({
        url: "/staff-shifts/weekly",
        method: "DELETE",
        params: { weekStartDate },
      }),
      transformResponse: (response: ApiResponse<WeeklyShiftSchedule>) => response.result,
      invalidatesTags: ["Staff"],
    }),
    copyWeeklyShiftSchedule: builder.mutation<
      WeeklyShiftSchedule,
      { sourceWeekStartDate: string; targetWeekStartDate: string }
    >({
      query: ({ sourceWeekStartDate, targetWeekStartDate }) => ({
        url: "/staff-shifts/weekly/copy",
        method: "POST",
        params: { sourceWeekStartDate, targetWeekStartDate },
      }),
      transformResponse: (response: ApiResponse<WeeklyShiftSchedule>) => response.result,
      invalidatesTags: ["Staff"],
    }),
    getMyHousekeepingTasks: builder.query<HousekeepingTask[], void>({
      query: () => ({ url: "/housekeeping-tasks/my", method: "GET" }),
      transformResponse: (response: ApiResponse<HousekeepingTask[]>) => response.result,
      providesTags: ["Room"],
    }),
    getHotelHousekeepingTasks: builder.query<HousekeepingTask[], void>({
      query: () => ({ url: "/housekeeping-tasks/management", method: "GET" }),
      transformResponse: (response: ApiResponse<HousekeepingTask[]>) => response.result,
      providesTags: ["Room"],
    }),
    assignHousekeepingTask: builder.mutation<HousekeepingTask, { taskId: string; employeeId: string }>({
      query: ({ taskId, employeeId }) => ({
        url: `/housekeeping-tasks/${encodeURIComponent(taskId)}/assign`,
        method: "PUT",
        params: { employeeId },
      }),
      transformResponse: (response: ApiResponse<HousekeepingTask>) => response.result,
      invalidatesTags: ["Room", "Notification"],
    }),
    completeHousekeepingTaskByManager: builder.mutation<HousekeepingTask, string>({
      query: (taskId) => ({
        url: `/housekeeping-tasks/${encodeURIComponent(taskId)}/management-complete`,
        method: "POST",
      }),
      transformResponse: (response: ApiResponse<HousekeepingTask>) => response.result,
      invalidatesTags: ["Room", "Notification"],
    }),
    completeHousekeepingTask: builder.mutation<HousekeepingTask, string>({
      query: (taskId) => ({ url: `/housekeeping-tasks/${encodeURIComponent(taskId)}/complete`, method: "POST" }),
      transformResponse: (response: ApiResponse<HousekeepingTask>) => response.result,
      invalidatesTags: ["Room", "Notification"],
    }),
  }),
});

export const {
  useGetTodayShiftAssignmentsQuery,
  useGetWeeklyShiftScheduleQuery,
  useSaveWeeklyShiftScheduleMutation,
  useClearWeeklyShiftScheduleMutation,
  useCopyWeeklyShiftScheduleMutation,
  useGetMyHousekeepingTasksQuery,
  useGetHotelHousekeepingTasksQuery,
  useAssignHousekeepingTaskMutation,
  useCompleteHousekeepingTaskByManagerMutation,
  useCompleteHousekeepingTaskMutation,
} = shiftApi;
