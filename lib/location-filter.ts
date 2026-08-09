import type { LocationCountryOption, LocationFilterSelection } from "@/types/app";
import { getUniqueStrings } from "@/lib/format";

export const LOCATION_FILTER_PREFIX = "jam-location-v1:";

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

export function parseLocationFilter(value: string): LocationFilterSelection[] {
  if (!value) return [];

  if (!value.startsWith(LOCATION_FILTER_PREFIX)) {
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

  try {
    const parsed = JSON.parse(value.slice(LOCATION_FILTER_PREFIX.length));
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry): LocationFilterSelection[] => {
      if (!entry || typeof entry.country !== "string") return [];
      const country = LOCATION_FILTER_COUNTRIES.find((option) => option.country === entry.country);
      if (!country) return [];
      const validCities = Array.isArray(entry.cities)
        ? entry.cities.filter((city: unknown): city is string => typeof city === "string" && country.cities.includes(city))
        : [];
      return [{ country: country.country, cities: getUniqueStrings(validCities) }];
    });
  } catch {
    return [];
  }
}

export function encodeLocationFilter(selections: readonly LocationFilterSelection[]) {
  const cleanSelections = selections
    .map((selection) => {
      const country = LOCATION_FILTER_COUNTRIES.find((option) => option.country === selection.country);
      if (!country) return null;
      const cities = getUniqueStrings(selection.cities).filter((city) => country.cities.includes(city));
      return { country: country.country, cities };
    })
    .filter((selection): selection is LocationFilterSelection => Boolean(selection));

  return cleanSelections.length ? `${LOCATION_FILTER_PREFIX}${JSON.stringify(cleanSelections)}` : "";
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
    if (!option) return false;

    if (selection.cities.length === 0) {
      return getCountryMatchTerms(option).some((term) => locationContainsTerm(normalizedItemLocation, term));
    }

    return selection.cities.some((city) => locationContainsTerm(normalizedItemLocation, normalizeLocationText(city)));
  });
}

export function getProfileLocationParts(profile?: { country?: string | null; city?: string | null; location?: string | null } | null) {
  const country = profile?.country?.trim() ?? "";
  const city = profile?.city?.trim() ?? "";
  if (country) return { country, city };

  const legacySelection = parseLocationFilter(profile?.location ?? "").at(0);
  return {
    country: legacySelection?.country ?? "",
    city: legacySelection?.cities.at(0) ?? "",
  };
}

export function formatProfileLocation(country: string, city: string) {
  const nextCountry = country.trim();
  const nextCity = city.trim();
  if (nextCountry && nextCity) return `${nextCity}, ${nextCountry}`;
  return nextCountry || null;
}
