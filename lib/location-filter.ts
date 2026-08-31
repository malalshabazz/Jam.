import type {
  LocationCountryOption,
  LocationFilterSelection,
  LocationGranularity,
  LocationPlace,
} from "@/types/app";
import { getUniqueStrings } from "@/lib/format";

export const LOCATION_FILTER_PREFIX = "jam-location-v1:";
export const LOCATION_FILTER_PREFIX_V2 = "jam-location-v2:";

function sortLocationCountries(options: readonly LocationCountryOption[]): readonly LocationCountryOption[] {
  return [...options]
    .sort((a, b) => a.country.localeCompare(b.country))
    .map((option) => ({
      ...option,
      cities: [...option.cities].sort((a, b) => a.localeCompare(b)),
    }));
}

export const LOCATION_FILTER_COUNTRIES = sortLocationCountries([
  { country: "United States", aliases: ["USA", "US", "America"], cities: ["New York", "Los Angeles", "Chicago", "Houston", "Miami"] },
  { country: "China", cities: ["Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Chengdu"] },
  { country: "India", cities: ["Mumbai", "Delhi", "Bengaluru", "Kolkata", "Chennai"] },
  { country: "Indonesia", cities: ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang"] },
  { country: "Pakistan", cities: ["Karachi", "Lahore", "Faisalabad", "Rawalpindi", "Islamabad"] },
  { country: "Brazil", cities: ["Sao Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Fortaleza"] },
  { country: "Nigeria", cities: ["Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt"] },
  { country: "Bangladesh", cities: ["Dhaka", "Chittagong", "Khulna", "Rajshahi", "Sylhet"] },
  { country: "Russia", cities: ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan"] },
  { country: "Mexico", cities: ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana"] },
  { country: "Japan", cities: ["Tokyo", "Osaka", "Nagoya", "Yokohama", "Fukuoka"] },
  { country: "Philippines", cities: ["Manila", "Quezon City", "Davao City", "Caloocan", "Cebu City"] },
  { country: "Ethiopia", cities: ["Addis Ababa", "Dire Dawa", "Mekelle", "Gondar", "Hawassa"] },
  { country: "Egypt", cities: ["Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Port Said"] },
  { country: "Vietnam", cities: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho"] },
  { country: "Democratic Republic of the Congo", aliases: ["DR Congo", "Congo"], cities: ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani"] },
  { country: "Turkey", cities: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya"] },
  { country: "Iran", cities: ["Tehran", "Mashhad", "Isfahan", "Karaj", "Shiraz"] },
  { country: "Germany", cities: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt"] },
  { country: "Thailand", cities: ["Bangkok", "Chiang Mai", "Pattaya", "Phuket", "Nakhon Ratchasima"] },
  { country: "United Kingdom", aliases: ["UK", "Great Britain", "England", "Scotland", "Wales"], cities: ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool"] },
  { country: "France", cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice"] },
  { country: "Italy", cities: ["Rome", "Milan", "Naples", "Turin", "Palermo"] },
  { country: "South Africa", cities: ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth"] },
  { country: "Tanzania", cities: ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma", "Mbeya"] },
  { country: "Myanmar", cities: ["Yangon", "Mandalay", "Naypyidaw", "Mawlamyine", "Bago"] },
  { country: "Kenya", cities: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"] },
  { country: "South Korea", aliases: ["Korea"], cities: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon"] },
  { country: "Colombia", cities: ["Bogota", "Medellin", "Cali", "Barranquilla", "Cartagena"] },
  { country: "Spain", cities: ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza"] },
  { country: "Argentina", cities: ["Buenos Aires", "Cordoba", "Rosario", "Mendoza", "La Plata"] },
  { country: "Algeria", cities: ["Algiers", "Oran", "Constantine", "Annaba", "Blida"] },
  { country: "Sudan", cities: ["Khartoum", "Omdurman", "Nyala", "Port Sudan", "Kassala"] },
  { country: "Uganda", cities: ["Kampala", "Gulu", "Lira", "Mbarara", "Jinja"] },
  { country: "Iraq", cities: ["Baghdad", "Basra", "Mosul", "Erbil", "Najaf"] },
  { country: "Ukraine", cities: ["Kyiv", "Kharkiv", "Odesa", "Dnipro", "Lviv"] },
  { country: "Canada", cities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa"] },
  { country: "Poland", cities: ["Warsaw", "Krakow", "Lodz", "Wroclaw", "Poznan"] },
  { country: "Morocco", cities: ["Casablanca", "Rabat", "Fes", "Marrakesh", "Tangier"] },
  { country: "Saudi Arabia", cities: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam"] },
  { country: "Uzbekistan", cities: ["Tashkent", "Samarkand", "Namangan", "Andijan", "Bukhara"] },
  { country: "Peru", cities: ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Cusco"] },
  { country: "Malaysia", cities: ["Kuala Lumpur", "George Town", "Johor Bahru", "Ipoh", "Kota Kinabalu"] },
  { country: "Angola", cities: ["Luanda", "Huambo", "Lobito", "Benguela", "Lubango"] },
  { country: "Mozambique", cities: ["Maputo", "Matola", "Beira", "Nampula", "Chimoio"] },
  { country: "Ghana", cities: ["Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast"] },
  { country: "Yemen", cities: ["Sanaa", "Aden", "Taiz", "Hodeidah", "Ibb"] },
  { country: "Nepal", cities: ["Kathmandu", "Pokhara", "Lalitpur", "Biratnagar", "Bharatpur"] },
  { country: "Venezuela", cities: ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Maracay"] },
  { country: "Netherlands", cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"] },
  { country: "Sweden", cities: ["Stockholm", "Gothenburg", "Malmo", "Uppsala", "Vasteras"] },
  { country: "Australia", cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"] },
]);


export function normalizeLocationText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getCountrySearchText(option: LocationCountryOption) {
  return [option.country, ...(option.aliases ?? []), ...option.cities].join(" ").toLowerCase();
}

export function getCountryMatchTerms(option: LocationCountryOption) {
  return [option.country, ...(option.aliases ?? [])].map(normalizeLocationText);
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function locationContainsTerm(location: string, term: string) {
  if (!term) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, "i").test(location);
}

function isLocationGranularity(value: unknown): value is LocationGranularity {
  return value === "city" || value === "region" || value === "country";
}

export function locationPlaceKey(place: Pick<LocationPlace, "granularity" | "country_code" | "country" | "region" | "city">) {
  return [
    place.granularity,
    normalizeLocationText(place.country_code || place.country),
    normalizeLocationText(place.region ?? ""),
    normalizeLocationText(place.city ?? ""),
  ].join("|");
}

export function locationSelectionKey(selection: LocationFilterSelection) {
  const city = selection.cities[0] ?? "";
  return locationPlaceKey({
    granularity: resolveSelectionGranularity(selection),
    country_code: selection.country_code ?? "",
    country: selection.country,
    region: selection.region ?? "",
    city,
  });
}

export function resolveSelectionGranularity(selection: LocationFilterSelection): LocationGranularity {
  if (isLocationGranularity(selection.granularity)) return selection.granularity;
  if (selection.cities.length > 0) return "city";
  if (selection.region?.trim()) return "region";
  return "country";
}

export function locationPlaceToSelection(place: LocationPlace): LocationFilterSelection {
  return {
    country: place.country,
    country_code: place.country_code || undefined,
    region: place.region ?? undefined,
    cities: place.city ? [place.city] : [],
    granularity: place.granularity,
  };
}

export function formatLocationSelection(selection: LocationFilterSelection) {
  return formatProfileLocation(
    selection.country,
    selection.cities[0] ?? "",
    selection.region,
  );
}

function parseStructuredLocationFilter(
  raw: string,
  allowUnknownCountries: boolean,
): LocationFilterSelection[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): LocationFilterSelection[] => {
      if (!entry || typeof entry.country !== "string" || !entry.country.trim()) return [];

      const country = allowUnknownCountries
        ? entry.country.trim()
        : LOCATION_FILTER_COUNTRIES.find((option) => option.country === entry.country)?.country;
      if (!country) return [];

      const listed = LOCATION_FILTER_COUNTRIES.find((option) => option.country === country);
      const cities = Array.isArray(entry.cities)
        ? entry.cities.filter((city: unknown): city is string => {
            if (typeof city !== "string" || !city.trim()) return false;
            if (allowUnknownCountries) return true;
            return Boolean(listed?.cities.includes(city));
          })
        : [];
      const region = typeof entry.region === "string" ? entry.region.trim() : "";
      const countryCode =
        typeof entry.country_code === "string" ? entry.country_code.trim().toUpperCase() : "";

      return [
        {
          country,
          cities: getUniqueStrings(cities),
          ...(countryCode ? { country_code: countryCode } : {}),
          ...(region ? { region } : {}),
          ...(isLocationGranularity(entry.granularity) ? { granularity: entry.granularity } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function parseLocationFilter(value: string): LocationFilterSelection[] {
  if (!value) return [];

  if (value.startsWith(LOCATION_FILTER_PREFIX_V2)) {
    return parseStructuredLocationFilter(value.slice(LOCATION_FILTER_PREFIX_V2.length), true);
  }

  if (value.startsWith(LOCATION_FILTER_PREFIX)) {
    return parseStructuredLocationFilter(value.slice(LOCATION_FILTER_PREFIX.length), false);
  }

  const normalizedValue = normalizeLocationText(value);
  const legacyMatch = LOCATION_FILTER_COUNTRIES.find(
    (option) =>
      getCountryMatchTerms(option).some((term) => locationContainsTerm(normalizedValue, term)) ||
      option.cities.some((city) => locationContainsTerm(normalizedValue, normalizeLocationText(city))),
  );

  if (!legacyMatch) return [];

  const legacyCities = legacyMatch.cities.filter((city) =>
    locationContainsTerm(normalizedValue, normalizeLocationText(city)),
  );
  return [{ country: legacyMatch.country, cities: legacyCities }];
}

export function encodeLocationFilter(selections: readonly LocationFilterSelection[]) {
  const cleanSelections = selections
    .map((selection) => {
      const country = selection.country.trim();
      if (!country) return null;
      const cities = getUniqueStrings(selection.cities);
      const region = selection.region?.trim() ?? "";
      const countryCode = selection.country_code?.trim().toUpperCase() ?? "";
      const granularity = resolveSelectionGranularity({
        ...selection,
        country,
        cities,
        region,
      });
      const next: LocationFilterSelection = {
        country,
        cities,
        granularity,
      };
      if (countryCode) next.country_code = countryCode;
      if (region) next.region = region;
      return next;
    })
    .filter((selection): selection is LocationFilterSelection => selection != null);

  return cleanSelections.length ? `${LOCATION_FILTER_PREFIX_V2}${JSON.stringify(cleanSelections)}` : "";
}

export function locationFilterMatches(itemLocation: string, filterValue: string) {
  if (!filterValue) return true;

  const normalizedItemLocation = normalizeLocationText(itemLocation);
  const selections = parseLocationFilter(filterValue);

  if (selections.length === 0) {
    const normalizedFilter = normalizeLocationText(filterValue);
    return normalizedItemLocation.includes(normalizedFilter) || normalizedFilter.includes(normalizedItemLocation);
  }

  return selections.some((selection) => {
    const option = LOCATION_FILTER_COUNTRIES.find((country) => country.country === selection.country);
    const countryTerms = [
      selection.country,
      ...(selection.country_code ? [selection.country_code] : []),
      ...(option ? getCountryMatchTerms(option) : []),
    ].map(normalizeLocationText);
    const countryMatch = countryTerms.some((term) => locationContainsTerm(normalizedItemLocation, term));
    if (!countryMatch) return false;

    const granularity = resolveSelectionGranularity(selection);
    if (granularity === "country") return true;

    if (granularity === "region") {
      return Boolean(selection.region && locationContainsTerm(normalizedItemLocation, normalizeLocationText(selection.region)));
    }

    const cities = selection.cities.length
      ? selection.cities
      : [];
    return cities.some((city) => locationContainsTerm(normalizedItemLocation, normalizeLocationText(city)));
  });
}

export function getProfileLocationParts(profile?: {
  country?: string | null;
  city?: string | null;
  region?: string | null;
  country_code?: string | null;
  location_granularity?: string | null;
  location?: string | null;
} | null) {
  const country = profile?.country?.trim() ?? "";
  const city = profile?.city?.trim() ?? "";
  const region = profile?.region?.trim() ?? "";
  const countryCode = profile?.country_code?.trim().toUpperCase() ?? "";
  const granularity = isLocationGranularity(profile?.location_granularity)
    ? profile.location_granularity
    : city
      ? "city"
      : region
        ? "region"
        : country
          ? "country"
          : null;

  if (country || city || region) {
    return { country, city, region, countryCode, granularity };
  }

  const legacySelection = parseLocationFilter(profile?.location ?? "").at(0);
  return {
    country: legacySelection?.country ?? "",
    city: legacySelection?.cities.at(0) ?? "",
    region: legacySelection?.region ?? "",
    countryCode: legacySelection?.country_code ?? "",
    granularity: legacySelection ? resolveSelectionGranularity(legacySelection) : null,
  };
}

export function formatProfileLocation(country: string, city: string, region?: string | null) {
  const nextCountry = country.trim();
  const nextCity = city.trim();
  const nextRegion = region?.trim() ?? "";
  const parts = [nextCity, nextRegion, nextCountry].filter((part, index, all) => {
    if (!part) return false;
    return !all.slice(0, index).some((earlier) => normalizeLocationText(earlier) === normalizeLocationText(part));
  });
  return parts.length ? parts.join(", ") : null;
}

export function formatProfileLocationLabel(
  profile?: {
    country?: string | null;
    city?: string | null;
    region?: string | null;
    country_code?: string | null;
    location_granularity?: string | null;
    location?: string | null;
  } | null,
) {
  const parts = getProfileLocationParts(profile);
  return formatProfileLocation(parts.country, parts.city, parts.region);
}

export function locationPartsToPlace(parts: ReturnType<typeof getProfileLocationParts>): LocationPlace | null {
  if (!parts.country && !parts.city && !parts.region) return null;
  const granularity = parts.granularity ?? (parts.city ? "city" : parts.region ? "region" : "country");
  return {
    label: formatProfileLocation(parts.country, parts.city, parts.region) ?? parts.country,
    granularity,
    country: parts.country,
    country_code: parts.countryCode,
    region: parts.region || null,
    city: parts.city || null,
    latitude: null,
    longitude: null,
  };
}
