export const NEAR_ME_RADIUS_OPTIONS = [5, 10, 25, 50] as const;

export type NearMeRadiusMiles = (typeof NEAR_ME_RADIUS_OPTIONS)[number];

const EARTH_RADIUS_MILES = 3958.7613;

export function normalizeNearMeRadius(value: number | null | undefined): NearMeRadiusMiles {
  if (value === 5 || value === 10 || value === 25 || value === 50) {
    return value;
  }

  return 25;
}

export function getDistanceInMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;

  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadiusMiles(
  viewerLatitude: number,
  viewerLongitude: number,
  targetLatitude: number,
  targetLongitude: number,
  radiusMiles: number,
) {
  return (
    getDistanceInMiles(viewerLatitude, viewerLongitude, targetLatitude, targetLongitude) <=
    radiusMiles
  );
}

export function isCreatorWithinNearMeRadius(
  viewerLatitude: number,
  viewerLongitude: number,
  profileLatitude: number | null | undefined,
  profileLongitude: number | null | undefined,
  liveLatitude: number | null | undefined,
  liveLongitude: number | null | undefined,
  radiusMiles: number,
) {
  if (
    profileLatitude != null &&
    profileLongitude != null &&
    isWithinRadiusMiles(
      viewerLatitude,
      viewerLongitude,
      profileLatitude,
      profileLongitude,
      radiusMiles,
    )
  ) {
    return true;
  }

  if (
    liveLatitude != null &&
    liveLongitude != null &&
    isWithinRadiusMiles(
      viewerLatitude,
      viewerLongitude,
      liveLatitude,
      liveLongitude,
      radiusMiles,
    )
  ) {
    return true;
  }

  return false;
}
