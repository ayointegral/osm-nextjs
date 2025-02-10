import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function LocationSearch() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'OSM Tile Viewer (https://github.com/yourusername/osmtileviewer)'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const results = await response.json();

      if (results && results[0]) {
        const { lat, lon } = results[0];
        // Convert lat/lon to tile coordinates
        const z = 12; // Default zoom level for searched locations
        const x = Math.floor((Number(lon) + 180) / 360 * Math.pow(2, z));
        const y = Math.floor((1 - Math.log(Math.tan(Number(lat) * Math.PI / 180) + 1 / Math.cos(Number(lat) * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
        
        router.push(`/osm/${z}/${x}/${y}`);
      } else {
        setError('No results found. Try a different search term.');
        searchInputRef.current?.focus();
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('An error occurred while searching. Please try again.');
      searchInputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError('');
            }}
            placeholder="Search location..."
            aria-label="Search location"
            aria-invalid="false"
            aria-describedby={error ? 'search-error' : undefined}
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
              disabled:opacity-50
              disabled:cursor-not-allowed
              transition-colors
              ${error ? 'border-red-500 focus:ring-red-500' : ''}
            `}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setQuery('');
                setError('');
                searchInputRef.current?.blur();
              }
            }}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
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
                disabled={!query.trim() || loading}
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
            )}
          </div>
        </div>
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
