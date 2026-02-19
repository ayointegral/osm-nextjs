import { useState, useRef, useEffect, useCallback } from 'react';

interface LocationSearchProps {
  onSelect: (lat: number, lon: number, zoom: number) => void;
}

interface GazetteerEntry {
  name: string;
  lat: number;
  lon: number;
  zoom: number;
}

const UK_GAZETTEER: GazetteerEntry[] = [
  { name: 'London', lat: 51.5074, lon: -0.1278, zoom: 13 },
  { name: 'Birmingham', lat: 52.4862, lon: -1.8904, zoom: 13 },
  { name: 'Manchester', lat: 53.4808, lon: -2.2426, zoom: 13 },
  { name: 'Leeds', lat: 53.8008, lon: -1.5491, zoom: 13 },
  { name: 'Glasgow', lat: 55.8642, lon: -4.2518, zoom: 13 },
  { name: 'Edinburgh', lat: 55.9533, lon: -3.1883, zoom: 13 },
  { name: 'Liverpool', lat: 53.4084, lon: -2.9916, zoom: 13 },
  { name: 'Bristol', lat: 51.4545, lon: -2.5879, zoom: 13 },
  { name: 'Sheffield', lat: 53.3811, lon: -1.4701, zoom: 13 },
  { name: 'Newcastle', lat: 54.9783, lon: -1.6178, zoom: 13 },
  { name: 'Cardiff', lat: 51.4816, lon: -3.1791, zoom: 13 },
  { name: 'Belfast', lat: 54.5973, lon: -5.9301, zoom: 13 },
  { name: 'Nottingham', lat: 52.9548, lon: -1.1581, zoom: 13 },
  { name: 'Southampton', lat: 50.9097, lon: -1.4044, zoom: 13 },
  { name: 'Leicester', lat: 52.6369, lon: -1.1398, zoom: 13 },
  { name: 'Coventry', lat: 52.4068, lon: -1.5197, zoom: 13 },
  { name: 'Bradford', lat: 53.7960, lon: -1.7594, zoom: 13 },
  { name: 'Brighton', lat: 50.8225, lon: -0.1372, zoom: 13 },
  { name: 'Plymouth', lat: 50.3755, lon: -4.1427, zoom: 13 },
  { name: 'Wolverhampton', lat: 52.5870, lon: -2.1288, zoom: 13 },
  { name: 'Reading', lat: 51.4543, lon: -0.9781, zoom: 13 },
  { name: 'Aberdeen', lat: 57.1497, lon: -2.0943, zoom: 13 },
  { name: 'Dundee', lat: 56.4620, lon: -2.9707, zoom: 13 },
  { name: 'Swansea', lat: 51.6214, lon: -3.9436, zoom: 13 },
  { name: 'Oxford', lat: 51.7520, lon: -1.2577, zoom: 13 },
  { name: 'Cambridge', lat: 52.2053, lon: 0.1218, zoom: 13 },
  { name: 'York', lat: 53.9591, lon: -1.0815, zoom: 13 },
  { name: 'Bath', lat: 51.3811, lon: -2.3590, zoom: 13 },
  { name: 'Canterbury', lat: 51.2802, lon: 1.0789, zoom: 13 },
  { name: 'Exeter', lat: 50.7184, lon: -3.5339, zoom: 13 },
  { name: 'Inverness', lat: 57.4778, lon: -4.2247, zoom: 13 },
  { name: 'Norwich', lat: 52.6309, lon: 1.2974, zoom: 13 },
  { name: 'Durham', lat: 54.7761, lon: -1.5733, zoom: 13 },
  { name: 'Chester', lat: 53.1930, lon: -2.8931, zoom: 13 },
  { name: 'Stirling', lat: 56.1166, lon: -3.9369, zoom: 13 },
  { name: 'Perth', lat: 56.3950, lon: -3.4308, zoom: 13 },
  { name: 'Carlisle', lat: 54.8925, lon: -2.9329, zoom: 13 },
  { name: 'Lancaster', lat: 54.0466, lon: -2.8007, zoom: 13 },
  { name: 'Salisbury', lat: 51.0688, lon: -1.7945, zoom: 13 },
  { name: 'Windsor', lat: 51.4839, lon: -0.6044, zoom: 13 },
  { name: 'Greenwich', lat: 51.4769, lon: -0.0005, zoom: 13 },
  { name: 'Westminster', lat: 51.4975, lon: -0.1357, zoom: 13 },
  { name: 'Stratford-upon-Avon', lat: 52.1917, lon: -1.7083, zoom: 13 },
  { name: 'Stonehenge', lat: 51.1789, lon: -1.8262, zoom: 10 },
  { name: 'Lake District', lat: 54.4609, lon: -3.0886, zoom: 10 },
  { name: 'Snowdonia', lat: 52.9186, lon: -3.8918, zoom: 10 },
  { name: 'Highlands', lat: 57.1200, lon: -4.7100, zoom: 10 },
  { name: 'Isle of Wight', lat: 50.6938, lon: -1.3047, zoom: 10 },
  { name: 'Isle of Skye', lat: 57.2736, lon: -6.2155, zoom: 10 },
  { name: 'Loch Ness', lat: 57.3229, lon: -4.4244, zoom: 10 },
];

function parseCoordinates(input: string): { lat: number; lon: number } | null {
  const trimmed = input.trim();

  // Try comma-separated: "51.505, -0.09"
  const commaMatch = trimmed.match(/^([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)$/);
  if (commaMatch) {
    const lat = parseFloat(commaMatch[1]);
    const lon = parseFloat(commaMatch[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon };
    }
  }

  // Try space-separated: "51.505 -0.09"
  const spaceMatch = trimmed.match(/^([+-]?\d+\.?\d*)\s+([+-]?\d+\.?\d*)$/);
  if (spaceMatch) {
    const lat = parseFloat(spaceMatch[1]);
    const lon = parseFloat(spaceMatch[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon };
    }
  }

  return null;
}

function validateCoordinates(lat: number, lon: number): boolean {
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function searchGazetteer(query: string): GazetteerEntry[] {
  if (query.length < 2) return [];
  const lower = query.toLowerCase();
  return UK_GAZETTEER.filter((entry) =>
    entry.name.toLowerCase().startsWith(lower)
  ).slice(0, 5);
}

export default function LocationSearch({ onSelect }: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<GazetteerEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setError('');
    setActiveIndex(-1);

    if (value.trim().length < 2) {
      closeDropdown();
      return;
    }

    // Don't show gazetteer suggestions if it looks like coordinates
    const coords = parseCoordinates(value);
    if (coords) {
      closeDropdown();
      return;
    }

    const matches = searchGazetteer(value.trim());
    if (matches.length > 0) {
      setSuggestions(matches);
      setShowDropdown(true);
    } else {
      closeDropdown();
    }
  };

  const selectPlace = (entry: GazetteerEntry) => {
    setQuery(entry.name);
    closeDropdown();
    setError('');
    onSelect(entry.lat, entry.lon, entry.zoom);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setError('');
    closeDropdown();

    // 1. Try coordinate parsing
    const coords = parseCoordinates(query);
    if (coords) {
      if (validateCoordinates(coords.lat, coords.lon)) {
        onSelect(coords.lat, coords.lon, 13);
        return;
      } else {
        setError('Invalid coordinates');
        searchInputRef.current?.focus();
        return;
      }
    }

    // 2. Try gazetteer exact/startsWith match (pick first)
    const matches = searchGazetteer(query.trim());
    if (matches.length > 0) {
      const best = matches[0];
      setQuery(best.name);
      onSelect(best.lat, best.lon, best.zoom);
      return;
    }

    // 3. No results
    setError('No results. Try coordinates (e.g., 51.505, -0.09)');
    searchInputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showDropdown) {
        closeDropdown();
      } else {
        setQuery('');
        setError('');
        searchInputRef.current?.blur();
      }
      return;
    }

    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectPlace(suggestions[activeIndex]);
    }
  };

  return (
    <div className="w-full" ref={containerRef}>
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search location..."
            aria-label="Search location"
            aria-invalid={!!error}
            aria-describedby={error ? 'search-error' : undefined}
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-controls={showDropdown ? 'location-suggestions' : undefined}
            aria-activedescendant={
              activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
            }
            role="combobox"
            className={`
              w-full px-4 py-3 pr-12
              bg-white
              border border-gray-300
              rounded-lg
              text-gray-900
              placeholder:text-gray-500
              focus:outline-none focus:ring-1 focus:ring-blue-500
              focus:border-blue-500
              shadow-sm
              transition-colors
              ${error ? 'border-red-500 focus:ring-red-500' : ''}
            `}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <button
              type="submit"
              className={`
                p-2 rounded-md
                text-gray-600
                hover:text-gray-900 hover:bg-gray-50
                focus:outline-none focus:ring-1 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              `}
              disabled={!query.trim()}
              aria-label="Search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </button>
          </div>
        </div>

        {showDropdown && suggestions.length > 0 && (
          <ul
            id="location-suggestions"
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden"
          >
            {suggestions.map((entry, index) => (
              <li
                key={entry.name}
                id={`suggestion-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`
                  px-4 py-2.5 cursor-pointer text-sm text-gray-900
                  transition-colors
                  ${
                    index === activeIndex
                      ? 'bg-blue-50 text-blue-900'
                      : 'hover:bg-gray-50'
                  }
                `}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectPlace(entry);
                }}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="font-medium">{entry.name}</span>
                <span className="ml-2 text-xs text-gray-500">
                  {entry.lat.toFixed(4)}, {entry.lon.toFixed(4)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p
            id="search-error"
            className="mt-2 text-sm text-red-600"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
