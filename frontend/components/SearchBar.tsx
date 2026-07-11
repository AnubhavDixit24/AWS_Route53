import { useEffect, useState, forwardRef } from "react";

interface SearchBarProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  debounceMs?: number;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { placeholder = "Search", onSearch, debounceMs = 300 },
  ref
) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => onSearch(value), debounceMs);
    return () => clearTimeout(handle);
  }, [value]);

  return (
    <input
      ref={ref}
      type="text"
      className="search-bar"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
});

export default SearchBar;