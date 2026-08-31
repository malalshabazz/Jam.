export type LocationGranularity = "city" | "region" | "country";

export type LocationPlace = {
  label: string;
  granularity: LocationGranularity;
  country: string;
  country_code: string;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};
