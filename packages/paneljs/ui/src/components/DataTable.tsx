import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Field, RecordData } from "../types";
import { fieldLabel, formatRecordValue } from "../utils/format";

/** Shared sizing so header and body columns line up. */
const headClass =
  "h-auto bg-muted px-4 py-3 text-xs font-medium text-(--text-secondary)";
const cellClass = "px-4 py-[13px] text-[13px] text-(--text-secondary)";
const rowNumberClass =
  "w-[42px] pr-2 text-right tabular-nums text-muted-foreground";
const selectionClass = "w-7 pl-4 pr-1.5";
const pillClass =
  "inline-flex px-2 py-[5px] text-[11px] leading-none bg-(--tag-background) text-(--tag-text)";

export const DataTable = ({
  records,
  fields,
  idField,
  canEdit,
  rowStart = 0,
  selectedIds,
  sort,
  dir,
  onSort,
  onToggleAll,
  onToggleSelected,
  onOpen,
}: {
  records: RecordData[];
  fields: Field[];
  idField: string;
  canEdit: boolean;
  rowStart?: number;
  selectedIds?: Set<string>;
  sort: string;
  dir: "asc" | "desc";
  onSort: (field: string) => void;
  onToggleAll?: (selected: boolean) => void;
  onToggleSelected?: (id: string, selected: boolean) => void;
  onOpen: (id: string) => void;
}) => {
  const selectable =
    selectedIds !== undefined && onToggleAll && onToggleSelected;
  const allSelected =
    records.length > 0 &&
    records.every((record) => selectedIds?.has(String(record[idField])));
  const someSelected =
    !allSelected &&
    records.some((record) => selectedIds?.has(String(record[idField])));
  const columnCount =
    fields.length + 1 + (canEdit ? 1 : 0) + (selectable ? 1 : 0);

  return (
    <Table className="min-w-full">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(headClass, rowNumberClass)} scope="col">
            <span className="sr-only">Row number</span>
            <span aria-hidden>#</span>
          </TableHead>
          {selectable && (
            <TableHead className={cn(headClass, selectionClass)}>
              <Checkbox
                aria-label="Select all records on this page"
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) => onToggleAll(checked)}
              />
            </TableHead>
          )}
          {fields.map((field) => {
            const sortable = field.type !== "relation";
            const isSorted = sortable && sort === field.name;
            return (
              <TableHead
                aria-sort={
                  isSorted
                    ? dir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined
                }
                className={headClass}
                key={field.name}
              >
                {sortable ? (
                  <button
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 [&_svg]:text-muted-foreground [&_svg]:opacity-75",
                      isSorted &&
                        "text-foreground [&_svg]:text-foreground [&_svg]:opacity-100",
                    )}
                    type="button"
                    onClick={() => onSort(field.name)}
                  >
                    <span>{fieldLabel(field.name)}</span>
                    {isSorted ? (
                      dir === "asc" ? (
                        <ArrowUp size={12} strokeWidth={2} aria-hidden />
                      ) : (
                        <ArrowDown size={12} strokeWidth={2} aria-hidden />
                      )
                    ) : (
                      <ArrowUpDown size={12} strokeWidth={1.75} aria-hidden />
                    )}
                  </button>
                ) : (
                  <span className="inline-flex">{fieldLabel(field.name)}</span>
                )}
              </TableHead>
            );
          })}
          {canEdit && (
            <TableHead
              className={cn(headClass, "w-9")}
              aria-label="Edit record"
            />
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              className="px-4 py-10 text-center text-muted-foreground"
              colSpan={columnCount}
            >
              No records match your current view.
            </TableCell>
          </TableRow>
        ) : (
          records.map((record, index) => {
            const id = String(record[idField]);
            const isSelected = selectedIds?.has(id) ?? false;
            return (
              <TableRow
                className={cn(
                  "hover:bg-(--table-row-hover) data-[state=selected]:bg-(--table-row-selected)",
                  canEdit && "cursor-pointer",
                )}
                data-state={isSelected ? "selected" : undefined}
                key={id}
                onClick={() => canEdit && onOpen(id)}
              >
                <TableCell className={cn(cellClass, rowNumberClass)}>
                  {rowStart + index + 1}
                </TableCell>
                {selectable && (
                  <TableCell
                    className={cn(cellClass, selectionClass)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      aria-label={`Select ${id}`}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        onToggleSelected(id, checked)
                      }
                    />
                  </TableCell>
                )}
                {fields.map((field, fieldIndex) => {
                  const value = formatRecordValue(record[field.name], field);
                  return (
                    <TableCell
                      className={cn(
                        cellClass,
                        fieldIndex === 0 && "font-medium text-foreground",
                        field.type === "datetime" &&
                          "tabular-nums text-muted-foreground",
                      )}
                      key={field.name}
                    >
                      {field.type === "boolean" ? (
                        <span
                          className={cn(
                            pillClass,
                            "rounded-full",
                            record[field.name] === true &&
                              "bg-(--success-surface) text-(--success)",
                          )}
                        >
                          {value}
                        </span>
                      ) : field.type === "enum" ? (
                        <span
                          className={cn(
                            pillClass,
                            "rounded-[5px] px-[7px] uppercase",
                          )}
                        >
                          {value}
                        </span>
                      ) : (
                        value
                      )}
                    </TableCell>
                  );
                })}
                {canEdit && (
                  <TableCell className={cn(cellClass, "w-9 py-0 text-right")}>
                    <Button
                      aria-label={`Open record ${id}`}
                      className="text-muted-foreground hover:text-foreground"
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(id);
                      }}
                    >
                      <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
};
