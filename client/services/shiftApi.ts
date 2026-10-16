import { baseApi } from "./baseApi";

export type ShiftAssignment = {
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

type ApiResponse<T> = {
  result: T;
};

export const shiftApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getWeeklyShiftSchedule: builder.query<WeeklyShiftSchedule, string | void>({
      query: (weekStartDate) => ({
        url: "/staff-shifts/weekly",
        method: "GET",
        params: weekStartDate ? { weekStartDate } : {},
      }),
      transformResponse: (response: ApiResponse<WeeklyShiftSchedule>) => response.result,
    }),
    getWeeklySchedule: builder.query<WeeklyShiftSchedule, { hotelId?: number; weekStartDate?: string } | void>({
      query: (params) => ({
        url: "/staff-shifts/weekly",
        method: "GET",
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<WeeklyShiftSchedule>) => response.result,
    }),
    assignBatchShifts: builder.mutation<any, { hotelId?: number; shifts?: any[]; assignments?: any[] }>({
      query: (body) => ({
        url: "/staff-shifts/assign-batch",
        method: "POST",
        data: body,
      }),
      transformResponse: (response: ApiResponse<any>) => response.result,
    }),
  }),
});

export const {
  useGetWeeklyShiftScheduleQuery,
  useGetWeeklyScheduleQuery,
  useAssignBatchShiftsMutation,
} = shiftApi;
