interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <span className="pagination-info">
        {start}-{end} of {total}
      </span>
      <button
        className="btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ‹ Previous
      </button>
      <span className="pagination-page">
        Page {page} of {totalPages}
      </span>
      <button
        className="btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next ›
      </button>
    </div>
  );
}