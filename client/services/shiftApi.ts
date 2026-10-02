import { baseApi } from "./baseApi";

export interface ShiftAssignment {
  id?: string;
  employeeId?: string;
  employeeName: string;
  employeePhone?: string;
  avatarUrl?: string;
  initials?: string;
  position?: string;
  hotelId?: number;
  workDate: string;
  dayKey: string;
  dayLabel: string;
  dateDisplay: string;
  shiftType: "Ca sáng" | "Ca tối";
  shiftTime: string;
  role: "Lễ tân" | "Housekeeping";
  task: string;
  status?: string;
  note?: string;
}

export interface DailyShiftSummary {
  date: string;
  dayKey: string;
  dayLabel: string;
  dateDisplay: string;
  fullyStaffed: boolean;
  totalAssigned: number;
  assignments: ShiftAssignment[];
}

export interface WeeklyScheduleResponse {
  hotelId: number;
  weekStartDate: string;
  weekEndDate: string;
  daysFullyStaffed: number;
  totalAssignments: number;
  totalUniqueStaff: number;
  days: DailyShiftSummary[];
}

export interface ShiftAssignRequest {
  hotelId?: number;
  employeeId?: string;
  employeeName: string;
  workDate: string;
  role: "Lễ tân" | "Housekeeping";
  shiftType: "Ca sáng" | "Ca tối";
  task: string;
  note?: string;
}

export interface ShiftBatchAssignRequest {
  hotelId?: number;
  shifts: ShiftAssignRequest[];
}

interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export const shiftApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWeeklySchedule: build.query<WeeklyScheduleResponse, { hotelId?: number; weekStartDate?: string } | void>({
      query: (params) => ({
        url: "/staff-shifts/weekly",
        method: "GET",
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<WeeklyScheduleResponse>) => response?.result,
      providesTags: ["Staff"],
    }),

    getTodayShifts: build.query<ShiftAssignment[], { hotelId?: number; date?: string } | void>({
      query: (params) => ({
        url: "/staff-shifts/today",
        method: "GET",
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<ShiftAssignment[]>) => response?.result ?? [],
      providesTags: ["Staff"],
    }),

    assignShift: build.mutation<ShiftAssignment, ShiftAssignRequest>({
      query: (body) => ({
        url: "/staff-shifts/assign",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Staff"],
    }),

    assignBatchShifts: build.mutation<ShiftAssignment[], ShiftBatchAssignRequest>({
      query: (body) => ({
        url: "/staff-shifts/assign-batch",
        method: "POST",
        data: body,
      }),
      invalidatesTags: ["Staff"],
    }),

    deleteShift: build.mutation<void, string>({
      query: (shiftId) => ({
        url: `/staff-shifts/${shiftId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Staff"],
    }),

    initDefaultSchedule: build.mutation<WeeklyScheduleResponse, { hotelId?: number; weekStartDate?: string }>({
      query: (params) => ({
        url: "/staff-shifts/init-default",
        method: "POST",
        params,
      }),
      invalidatesTags: ["Staff"],
    }),
  }),
});

export const {
  useGetWeeklyScheduleQuery,
  useGetTodayShiftsQuery,
  useAssignShiftMutation,
  useAssignBatchShiftsMutation,
  useDeleteShiftMutation,
  useInitDefaultScheduleMutation,
} = shiftApi;
