export type Trip = {
  id: string;
  start_date: string | null;
  base_location: string | null;
  flight_arrival: string | null;
  flight_departure: string | null;
  flight_outbound_number: string | null;
  flight_return_number: string | null;
  hotel_checkin: string | null;
  hotel_checkout: string | null;
  airport_transfer_minutes: number | null;
  late_checkin_confirmed: boolean | null;
};

export type TripDayOption = {
  id: string;
  day_number: number;
  date: string | null;
};
