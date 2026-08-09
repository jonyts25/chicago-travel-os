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
  baseLocation: string | null;
  travelers: TripTravelerPreferences[];
  existingPlaceNames: string[];
};
