"use client";

import { useEffect, useId, useState } from "react";
import { formatDate } from "@/lib/utils/format-date";

export type SelectedProfile = {
  id: string;
  fullName: string;
};

type SearchResult = {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
};

type SearchableProfileSelectorProps = {
  label?: string;
  selectedProfile?: SelectedProfile | null;
  onSelect: (profile: SelectedProfile) => void;
};

export function SearchableProfileSelector({
  label = "Profile",
  selectedProfile,
  onSelect
}: SearchableProfileSelectorProps) {
  const inputId = useId();
  const [query, setQuery] = useState(selectedProfile?.fullName ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);

      try {
        const response = await fetch(
          `/api/profiles/search?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: controller.signal
          }
        );

        if (!response.ok) {
          setResults([]);
          return;
        }

        const profiles = (await response.json()) as SearchResult[];
        setResults(profiles);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  function handleSelect(profile: SearchResult) {
    setQuery(profile.fullName);
    setResults([]);
    setHasSearched(false);
    onSelect({
      id: profile.id,
      fullName: profile.fullName
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);

    if (value.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        placeholder="Type at least 2 characters"
        className="mt-2 w-full rounded border border-line px-3 py-2 text-sm outline-none transition focus:border-moss"
      />

      {query.trim().length >= 2 ? (
        <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded border border-line bg-white shadow-sm">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-neutral-700">Searching...</div>
          ) : null}

          {!isLoading && hasSearched && results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-700">
              No matching profiles found.
            </div>
          ) : null}

          {!isLoading && results.length > 0 ? (
            <ul className="divide-y divide-line">
              {results.map((profile) => (
                <li key={profile.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(profile)}
                    className="block w-full px-3 py-2 text-left text-sm transition hover:bg-paper"
                  >
                    <span className="font-medium text-ink">
                      {profile.fullName}
                    </span>
                    <span className="mt-1 block text-xs text-neutral-600">
                      Birth: {formatDate(profile.dateOfBirth)} - Death:{" "}
                      {formatDate(profile.dateOfDeath)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
