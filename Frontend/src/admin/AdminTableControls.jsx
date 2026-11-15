import { FaPlus } from "react-icons/fa";

export const ADMIN_TABLE_PAGE_SIZE = 10;

export function AdminTableSearch({
    value,
    onChange,
    onSearch,
    onClear,
    placeholder,
}) {
    return (
        <form
            className="admin-table-search"
            role="search"
            onSubmit={(event) => {
                event.preventDefault();
                onSearch();
            }}
        >
            <div className="admin-table-search-field">
                <input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    aria-label={placeholder}
                />
                {value && (
                    <button
                        type="button"
                        className="admin-table-search-clear"
                        aria-label="Clear search"
                        onClick={onClear}
                    >
                        ×
                    </button>
                )}
            </div>
            <button type="submit" className="admin-table-search-button">
                Search
            </button>
        </form>
    );
}

export function AdminAddButton({
    children,
    className = "",
    icon: Icon = FaPlus,
    ...buttonProps
}) {
    return (
        <button
            className={`admin-add-button ${className}`.trim()}
            {...buttonProps}
        >
            <Icon aria-hidden="true" />
            {children}
        </button>
    );
}

export function AdminPagination({ page, totalItems, onPageChange }) {
    const totalPages = Math.max(1, Math.ceil(totalItems / ADMIN_TABLE_PAGE_SIZE));

    return (
        <nav className="admin-pagination" aria-label="Table pagination">
            <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
            >
                {"<"}
            </button>
            <span aria-live="polite">{page} / {totalPages}</span>
            <button
                type="button"
                aria-label="Next page"
                disabled={page >= totalPages}
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            >
                {">"}
            </button>
        </nav>
    );
}
