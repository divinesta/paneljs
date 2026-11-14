import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiNotice, NotFound } from "../components/Feedback";
import { ActionBar } from "../components/ActionBar";
import { DataTable } from "../components/DataTable";
import { DateRangeControl, FilterControl } from "../components/FilterSidebar";
import { useFilters } from "../hooks/useFilters";
import { useModelData } from "../hooks/useModelData";
import { useBulkActions } from "../hooks/useBulkActions";
import type { Field, ListAction, Schema, SortKey } from "../types";

/** Most sort columns the server accepts. */
const MAX_SORT_KEYS = 5;

/**
 * Plain click: sort by this column only, flipping direction if it already
 * leads. Shift+click: add it as the next column, or flip it if present.
 */
const nextSort = (
  sort: SortKey[],
  field: string,
  additive: boolean,
): SortKey[] => {
  const flip = (key: SortKey): SortKey => ({
    field: key.field,
    direction: key.direction === "asc" ? "desc" : "asc",
  });
  const existing = sort.find((key) => key.field === field);
  if (!additive)
    return [
      existing && sort[0]?.field === field
        ? flip(existing)
        : { field, direction: "asc" },
    ];
  if (existing)
    return sort.map((key) => (key.field === field ? flip(key) : key));
  if (sort.length >= MAX_SORT_KEYS) return sort;
  return [...sort, { field, direction: "asc" }];
};

const tableCardClass =
  "w-full overflow-hidden rounded-lg border bg-card text-card-foreground";
const pageButtonClass = "bg-card text-(--text-secondary) max-[760px]:size-11";

/**
 * Free-text columns match by "contains"; foreign keys (read-only strings such
 * as "authorId") and every other type match exactly.
 */
const textFilterParam = (field: Field): string =>
  field.type === "string" && !field.isReadOnly
    ? `${field.name}__contains`
    : field.name;

export const ListView = ({ schema }: { schema: Schema }) => {
  const { model: modelPath } = useParams();
  const navigate = useNavigate();
  const model = useMemo(
    () =>
      schema.models.find(
        (candidate) => candidate.meta.pluralName === modelPath,
      ),
    [modelPath, schema.models],
  );
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey[]>(model?.config.defaultSort ?? []);
  const { filters, updateFilter, resetFilters } = useFilters();
  const data = useModelData(model, page, search, filters, sort);
  const bulkActions = useBulkActions(model);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const totalPages = Math.max(data.totalPages, 1);
  useEffect(() => {
    setSearchDraft("");
    setSearch("");
    setPage(1);
    setSort(model?.config.defaultSort ?? []);
    resetFilters();
    setSelectedIds(new Set());
  }, [modelPath]);
  useEffect(() => {
    if (data.status === "ready" && page > totalPages) setPage(totalPages);
  }, [data.status, page, totalPages]);
  if (!model || !model.config.permissions.list) return <NotFound />;
  const listFields = model.config.listDisplay
    .map((name) => model.meta.fields.find((field) => field.name === name))
    .filter((field): field is Field => Boolean(field));
  // Each control is named by its filter key ("author__role") so labels and
  // query parameters follow the path; the rest comes from the end field.
  const filterFields = model.config.filterFields.map(({ key, field }) => ({
    ...field,
    name: key,
  }));
  const reset = () => {
    setSearchDraft("");
    setSearch("");
    resetFilters();
    setPage(1);
  };
  const toggleSort = (field: string, additive: boolean) => {
    setPage(1);
    setSort((current) => nextSort(current, field, additive));
  };
  const changeFilter = (name: string, value: string) => {
    setPage(1);
    updateFilter(name, value);
  };
  const goToPreviousPage = () => setPage((current) => Math.max(1, current - 1));
  const goToNextPage = () =>
    setPage((current) => Math.min(totalPages, current + 1));
  const executeAction = async (action: ListAction) => {
    const ids = [...selectedIds];
    const message = `Run “${action.label}” for ${ids.length} selected ${ids.length === 1 ? "record" : "records"}?`;
    if (!window.confirm(message)) return;
    if (await bulkActions.run(action.name, ids)) {
      setSelectedIds(new Set());
      data.refresh();
    }
  };
  const runAction = (action: ListAction) => {
    if (action.name === "delete_selected") {
      navigate(
        `/${model.meta.pluralName}/delete?${new URLSearchParams({ ids: [...selectedIds].join(",") })}`,
      );
      return;
    }
    void executeAction(action);
  };
  return (
    <section className="page-section">
      <div className="page-heading model-list-heading">
        <div>
          <h1>{model.meta.name}</h1>
          <p>
            {data.total} {data.total === 1 ? "record" : "records"} available to
            your account.
          </p>
        </div>
        {model.config.permissions.create && (
          <NavLink
            className="primary-button"
            to={`/${model.meta.pluralName}/new`}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
            New {model.meta.name}
          </NavLink>
        )}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2.5 max-[760px]:flex-col max-[760px]:items-stretch">
        <form
          className="min-w-0 flex-[0_1_480px] max-[760px]:w-full max-[760px]:flex-none"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchDraft.trim());
          }}
        >
          <InputGroup className="h-10 rounded-md bg-(--surface-input) max-[760px]:h-11">
            <InputGroupAddon className="pl-3.5">
              <Search strokeWidth={1.75} aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              aria-label={`Search ${model.meta.name}`}
              className="text-sm max-[760px]:text-base"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder={`Search ${model.meta.name.toLowerCase()}…`}
            />
            {/* mr-0 cancels shadcn's negative margin, which is sized for a 32px group. */}
            <InputGroupAddon
              align="inline-end"
              className="pr-[5px] has-[>button]:mr-0"
            >
              <InputGroupButton
                className="h-[30px] rounded-sm px-3 text-xs text-(--text-secondary) hover:bg-(--sidebar-hover) hover:text-foreground"
                type="submit"
                variant="secondary"
              >
                <Search strokeWidth={2} aria-hidden />
                Search
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
        <Button
          className="h-10 px-3.5 max-[760px]:self-start"
          type="button"
          variant="outline"
          onClick={reset}
        >
          Reset
        </Button>
      </div>
      {filterFields.length > 0 && (
        <div
          className="mb-5 flex flex-wrap items-center gap-2 py-0.5 max-[760px]:items-stretch"
          aria-label="Filters"
        >
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden />
            Filters
          </span>
          <div className="flex min-w-0 flex-[1_1_760px] flex-wrap items-center gap-2 max-[760px]:basis-full">
            {filterFields.map((field) =>
              field.type === "datetime" ? (
                <DateRangeControl
                  field={field}
                  key={field.name}
                  from={filters[`${field.name}__gte`] ?? ""}
                  to={filters[`${field.name}__lte`] ?? ""}
                  onChange={(key, value) =>
                    changeFilter(`${field.name}__${key}`, value)
                  }
                />
              ) : (
                <FilterControl
                  field={field}
                  key={field.name}
                  value={filters[textFilterParam(field)] ?? ""}
                  onChange={(value) =>
                    changeFilter(textFilterParam(field), value)
                  }
                />
              ),
            )}
          </div>
        </div>
      )}
      {data.status === "error" && <ApiNotice message={data.error} />}
      {bulkActions.error && <ApiNotice message={bulkActions.error} />}
      {bulkActions.message && (
        <div
          className="mb-3.5 rounded-md border border-(--success)/25 bg-(--success-surface) px-3.5 py-3 text-xs text-(--success)"
          role="status"
        >
          {bulkActions.message}
        </div>
      )}
      {data.status === "loading" && (
        <div
          className={cn(tableCardClass, "px-4 py-2")}
          role="status"
          aria-label="Loading records"
        >
          <span className="sr-only">Loading records…</span>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="grid grid-cols-[2fr_1fr_80px] gap-8 border-b py-[19px] last:border-b-0"
              key={index}
              aria-hidden="true"
            >
              <Skeleton className="h-3.5" />
              <Skeleton className="h-3.5" />
              <Skeleton className="h-3.5" />
            </div>
          ))}
        </div>
      )}
      {data.status === "ready" && (
        <div className={tableCardClass}>
          {selectedIds.size > 0 && (
            <ActionBar
              actions={model.config.actions}
              selectedCount={selectedIds.size}
              busy={bulkActions.status === "running"}
              onRun={runAction}
            />
          )}
          <DataTable
            records={data.records}
            fields={listFields}
            idField={model.meta.idField}
            canEdit={model.config.permissions.view}
            rowStart={(page - 1) * model.config.perPage}
            selectedIds={
              model.config.actions.length > 0 ? selectedIds : undefined
            }
            sort={sort}
            sortKeys={model.config.sortKeys}
            onSort={toggleSort}
            onToggleAll={(selected) =>
              setSelectedIds((current) => {
                const next = new Set(current);
                data.records.forEach((record) => {
                  const id = String(record[model.meta.idField]);
                  if (selected) next.add(id);
                  else next.delete(id);
                });
                return next;
              })
            }
            onToggleSelected={(id, selected) =>
              setSelectedIds((current) => {
                const next = new Set(current);
                if (selected) next.add(id);
                else next.delete(id);
                return next;
              })
            }
            onOpen={(id) =>
              navigate(
                model.config.permissions.update
                  ? `/${model.meta.pluralName}/${id}/edit`
                  : `/${model.meta.pluralName}/${id}`,
              )
            }
          />
          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground max-[760px]:flex-col max-[760px]:items-start max-[760px]:gap-2.5">
            <span>
              Showing{" "}
              {data.records.length ? (page - 1) * model.config.perPage + 1 : 0}–
              {Math.min(
                (page - 1) * model.config.perPage + data.records.length,
                data.total,
              )}{" "}
              of {data.total}
            </span>
            <div className="flex items-center gap-2.5">
              <Button
                aria-label="Previous page"
                className={pageButtonClass}
                disabled={page <= 1}
                size="icon"
                type="button"
                variant="outline"
                onClick={goToPreviousPage}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                aria-label="Next page"
                className={pageButtonClass}
                disabled={page >= totalPages}
                size="icon"
                type="button"
                variant="outline"
                onClick={goToNextPage}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
