import type { TripType } from "@/lib/trips/types";

export type UserProfile = {
  id: string;
  preferences: string | null;
  email: string | null;
};

export type TripTravelerPreferences = {
  userId: string;
  label: string;
  preferences: string | null;
  isCurrentUser: boolean;
};

export type SuggestionContext = {
  tripType: TripType;
  tripName: string;
  baseLocation: string | null;
  centerLat: number | null;
  centerLng: number | null;
  travelers: TripTravelerPreferences[];
  existingPlaceNames: string[];
};
