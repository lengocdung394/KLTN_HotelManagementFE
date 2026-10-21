import { baseApi } from "./baseApi";

export type ShiftAssignment = {
  id?: string;
  employeeId: string;
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
};

type ApiResponse<T> = {
  result: T;
};

export const shiftApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
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
    getMyHousekeepingTasks: builder.query<HousekeepingTask[], void>({
      query: () => ({ url: "/housekeeping-tasks/my", method: "GET" }),
      transformResponse: (response: ApiResponse<HousekeepingTask[]>) => response.result,
      providesTags: ["Room"],
    }),
    completeHousekeepingTask: builder.mutation<HousekeepingTask, string>({
      query: (taskId) => ({ url: `/housekeeping-tasks/${encodeURIComponent(taskId)}/complete`, method: "POST" }),
      transformResponse: (response: ApiResponse<HousekeepingTask>) => response.result,
      invalidatesTags: ["Room", "Notification"],
    }),
  }),
});

export const {
  useGetWeeklyShiftScheduleQuery,
  useSaveWeeklyShiftScheduleMutation,
  useGetMyHousekeepingTasksQuery,
  useCompleteHousekeepingTaskMutation,
} = shiftApi;
