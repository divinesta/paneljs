import { ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import type { Field } from "../types";
import { fieldLabel } from "../utils/format";

export const FilterControl = ({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) => {
  if (field.type === "enum" || field.type === "boolean") {
    const options =
      field.type === "boolean"
        ? [
            { label: "Yes", value: "true" },
            { label: "No", value: "false" },
          ]
        : (field.enumValues ?? []).map((option) => ({
            label: option,
            value: option,
          }));
    // Base UI uses null for "nothing selected"; the filter state uses "".
    const items = [{ label: "Any", value: null as string | null }, ...options];
    return (
      <Select
        items={items}
        value={value === "" ? null : value}
        onValueChange={(next) => onChange(next ?? "")}
      >
        <SelectTrigger
          aria-label={`${fieldLabel(field.name)} filter`}
          className="h-9 min-w-40 gap-2 rounded-md bg-(--surface-input) px-3 text-[13px]"
        >
          <span className="text-xs text-muted-foreground">
            {fieldLabel(field.name)}
          </span>
          <SelectValue className="text-foreground" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value ?? "any"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <InputGroup className="h-9 w-auto min-w-40 rounded-md bg-(--surface-input) max-[760px]:h-11 max-[760px]:w-full">
      <InputGroupAddon className="pl-3">
        <InputGroupText className="text-xs">
          {fieldLabel(field.name)}
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        aria-label={`${fieldLabel(field.name)} filter`}
        className="text-[13px] max-[760px]:text-base"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Any"
      />
    </InputGroup>
  );
};

export const DateRangeControl = ({
  field,
  from,
  to,
  onChange,
}: {
  field: Field;
  from: string;
  to: string;
  onChange: (key: "gte" | "lte", value: string) => void;
}) => (
  <span className="filter-control date-range-control">
    <span>{fieldLabel(field.name)}</span>
    <input
      aria-label={`${fieldLabel(field.name)} from`}
      type="date"
      value={from}
      onChange={(event) => onChange("gte", event.target.value)}
    />
    <ArrowRight size={12} strokeWidth={1.75} aria-hidden />
    <input
      aria-label={`${fieldLabel(field.name)} to`}
      type="date"
      value={to}
      onChange={(event) => onChange("lte", event.target.value)}
    />
  </span>
);
