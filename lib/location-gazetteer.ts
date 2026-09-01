import { LOCATION_FILTER_COUNTRIES, normalizeLocationText } from "@/lib/location-filter";
import type { LocationPlace } from "@/lib/location-place";

/** Extra well-known cities so prefix search finds them before Nominatim does. */
const EXTRA_GAZETTEER_CITIES: Record<string, readonly string[]> = {
  "United Kingdom": [
    "Leeds",
    "Sheffield",
    "Bristol",
    "Edinburgh",
    "Cardiff",
    "Belfast",
    "Newcastle",
    "Nottingham",
    "Leicester",
    "Coventry",
    "Bradford",
    "Southampton",
    "Brighton",
    "Plymouth",
    "Stoke-on-Trent",
    "Wolverhampton",
    "Derby",
    "Reading",
    "Northampton",
    "Luton",
    "Aberdeen",
    "Cambridge",
    "Oxford",
    "York",
    "Swansea",
    "Dundee",
    "Middlesbrough",
    "Portsmouth",
    "Milton Keynes",
    "Norwich",
    "Exeter",
    "Bath",
    "Canterbury",
  ],
  "United States": [
    "San Francisco",
    "Seattle",
    "Boston",
    "Atlanta",
    "Dallas",
    "Philadelphia",
    "Phoenix",
    "Denver",
    "Austin",
    "Nashville",
    "Portland",
    "Detroit",
    "Minneapolis",
    "Washington",
  ],
};

const COUNTRY_CODES: Record<string, string> = {
  "United States": "US",
  China: "CN",
  India: "IN",
  Indonesia: "ID",
  Pakistan: "PK",
  Brazil: "BR",
  Nigeria: "NG",
  Bangladesh: "BD",
  Russia: "RU",
  Mexico: "MX",
  Japan: "JP",
  Philippines: "PH",
  Ethiopia: "ET",
  Egypt: "EG",
  Vietnam: "VN",
  "Democratic Republic of the Congo": "CD",
  Turkey: "TR",
  Iran: "IR",
  Germany: "DE",
  Thailand: "TH",
  "United Kingdom": "GB",
  France: "FR",
  Italy: "IT",
  "South Africa": "ZA",
  Tanzania: "TZ",
  Myanmar: "MM",
  Kenya: "KE",
  "South Korea": "KR",
  Colombia: "CO",
  Spain: "ES",
  Argentina: "AR",
  Algeria: "DZ",
  Sudan: "SD",
  Uganda: "UG",
  Iraq: "IQ",
  Ukraine: "UA",
  Canada: "CA",
  Poland: "PL",
  Morocco: "MA",
  "Saudi Arabia": "SA",
  Uzbekistan: "UZ",
  Peru: "PE",
  Malaysia: "MY",
  Angola: "AO",
  Mozambique: "MZ",
  Ghana: "GH",
  Yemen: "YE",
  Nepal: "NP",
  Venezuela: "VE",
  Netherlands: "NL",
  Sweden: "SE",
  Australia: "AU",
};

function gazetteerCitiesFor(option: (typeof LOCATION_FILTER_COUNTRIES)[number]) {
  const extra = EXTRA_GAZETTEER_CITIES[option.country] ?? [];
  return [...new Set([...option.cities, ...extra])];
}

export function searchGazetteerPlaces(query: string): LocationPlace[] {
  const needle = normalizeLocationText(query);
  if (needle.length < 3) return [];

  const prefix: LocationPlace[] = [];
  const contains: LocationPlace[] = [];

  for (const option of LOCATION_FILTER_COUNTRIES) {
    const countryCode = COUNTRY_CODES[option.country] ?? "";
    const countryTerms = [option.country, ...(option.aliases ?? [])].map(normalizeLocationText);
    const countryPrefix = countryTerms.some((term) => term.startsWith(needle));
    const countryContains = countryTerms.some((term) => term.includes(needle));

    if (countryPrefix || countryContains) {
      const place: LocationPlace = {
        label: option.country,
        granularity: "country",
        country: option.country,
        country_code: countryCode,
        region: null,
        city: null,
        latitude: null,
        longitude: null,
      };
      (countryPrefix ? prefix : contains).push(place);
    }

    for (const city of gazetteerCitiesFor(option)) {
      const cityKey = normalizeLocationText(city);
      if (!cityKey.includes(needle)) continue;
      const place: LocationPlace = {
        label: `${city}, ${option.country}`,
        granularity: "city",
        country: option.country,
        country_code: countryCode,
        region: null,
        city,
        latitude: null,
        longitude: null,
      };
      (cityKey.startsWith(needle) ? prefix : contains).push(place);
    }
  }

  return [...prefix, ...contains];
}

export function mergeLocationPlaces(primary: LocationPlace[], secondary: LocationPlace[]) {
  const seen = new Set<string>();
  const merged: LocationPlace[] = [];

  for (const place of [...primary, ...secondary]) {
    const countryKey = place.country_code || normalizeLocationText(place.country);
    const key =
      place.granularity === "city"
        ? `city|${countryKey}|${normalizeLocationText(place.city ?? "")}`
        : [place.granularity, countryKey, normalizeLocationText(place.region ?? "")].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(place);
  }

  return merged;
}
