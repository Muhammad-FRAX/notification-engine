import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { EmptyState } from './empty-state'
import { Spinner } from './spinner'

function SortIcon({ direction }) {
  if (direction === 'asc')  return <ChevronUp size={11} />
  if (direction === 'desc') return <ChevronDown size={11} />
  return <ChevronsUpDown size={11} className="opacity-40" />
}

export function DataTable({
  columns,
  data = [],
  loading = false,
  pageSize = 20,
  emptyIcon,
  emptyTitle = 'No results',
  emptyDescription,
  emptyAction,
  className,
  rowActions,
  onRowClick,
}) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [page, setPage] = useState(0)

  function toggleSort(key) {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
    }))
    setPage(0)
  }

  const sorted = useMemo(() => {
    if (!sort.key) return data
    const col = columns.find(c => c.key === sort.key)
    if (!col) return data
    const getValue = col.sortValue ?? (row => row[sort.key])
    return [...data].sort((a, b) => {
      const av = getValue(a)
      const bv = getValue(b)
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [data, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table
          className="w-full border-collapse text-sm"
          style={{ tableLayout: 'fixed' }}
        >
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-elev)]">
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className={cn(
                    'px-3 py-2 text-left text-xs font-medium text-[var(--text-muted)]',
                    'whitespace-nowrap select-none',
                    col.sortable && 'cursor-pointer hover:text-[var(--text)] group'
                  )}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="text-[var(--text-subtle)]">
                        <SortIcon direction={sort.key === col.key ? sort.dir : null} />
                      </span>
                    )}
                  </span>
                </th>
              ))}
              {rowActions && <th className="w-16 px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={columns.length + (rowActions ? 1 : 0)}
                  className="py-12 text-center"
                >
                  <Spinner className="mx-auto" />
                </td>
              </tr>
            )}
            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)}>
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            )}
            {!loading && paginated.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-[var(--border)] last:border-b-0',
                  'bg-[var(--bg-elev)] transition-colors duration-[120ms]',
                  (onRowClick) && 'cursor-pointer hover:bg-[var(--accent-soft)]',
                )}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-2 text-sm text-[var(--text)]',
                      'truncate',
                      col.className
                    )}
                  >
                    {col.cell ? col.cell(row) : row[col.key]}
                  </td>
                ))}
                {rowActions && (
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      {rowActions(row)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-2">
          <span className="text-xs text-[var(--text-subtle)] font-tabular">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              intent="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={12} />
            </Button>
            <span className="text-xs text-[var(--text-muted)] px-1 font-tabular">
              {page + 1} / {totalPages}
            </span>
            <Button
              intent="ghost"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight size={12} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
