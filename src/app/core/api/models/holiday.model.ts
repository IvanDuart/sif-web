export type HolidayType = 'NATIONAL' | 'LOCAL';

export interface HolidayDto {
  id: string;
  holidayDate: string;
  description: string;
  type: HolidayType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHolidayRequest {
  holidayDate: string;
  description: string;
  type: HolidayType;
}
