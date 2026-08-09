export type Trip = {
  id: string;
  start_date: string | null;
  base_location: string | null;
  flight_departure: string | null;
  airport_transfer_minutes: number | null;
};

export type TripDayOption = {
  id: string;
  day_number: number;
  date: string | null;
};
