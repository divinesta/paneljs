import type { FullRegisteredModel } from "./registry.js";
import type { FieldFilters, SearchQuery } from "./query.js";
import type { AdminFieldMeta, AdminModelMeta } from "./types.js";
import { isFieldVisible, RequestValidationError } from "./validation.js";

export type QueryValue = string | string[] | undefined;
export type QueryMap = Record<string, QueryValue>;

export type ParsedListQuery = {
   page: number;
   sort: string;
   dir: "asc" | "desc";
   filters: FieldFilters;
   search?: SearchQuery;
};

function getQueryValue(query: QueryMap, name: string): string | undefined {
   const value = query[name];
   if (value === undefined) return undefined;
   if (typeof value !== "string") throw new RequestValidationError(`Query parameter "${name}" must be a single string value.`);
   return value;
}

function parseFilterValue(field: AdminFieldMeta, value: string): string | number | boolean | Date {
   switch (field.type) {
      case "string":
      case "bytes":
         return value;
      case "number": {
         const number = Number(value);
         if (!Number.isFinite(number)) throw new RequestValidationError(`Filter "${field.name}" must be a finite number.`);
         return number;
      }
      case "boolean":
         if (value !== "true" && value !== "false") throw new RequestValidationError(`Filter "${field.name}" must be "true" or "false".`);
         return value === "true";
      case "datetime": {
         const date = new Date(value);
         if (Number.isNaN(date.getTime())) throw new RequestValidationError(`Filter "${field.name}" must be an ISO date-time value.`);
         return date;
      }
      case "enum":
         if (!field.enumValues?.includes(value)) throw new RequestValidationError(`Filter "${field.name}" must be a valid ${field.nativeType} value.`);
         return value;
      case "json":
      case "relation":
         throw new RequestValidationError(`Filter "${field.name}" is not supported.`);
   }
}

export function parseListQuery(query: QueryMap, meta: AdminModelMeta, model: FullRegisteredModel): ParsedListQuery {
   const pageValue = Number(getQueryValue(query, "page") ?? 1);
   if (!Number.isInteger(pageValue) || pageValue < 1) throw new RequestValidationError("Query parameter \"page\" must be a positive integer.");
   if (pageValue > 10_000) throw new RequestValidationError("Query parameter \"page\" must be 10,000 or fewer.");

   const sort = getQueryValue(query, "sort") ?? model.resolved.defaultSort.field;
   const dir = getQueryValue(query, "dir") ?? model.resolved.defaultSort.direction;
   const sortableFields = new Set(meta.fields.filter((field) => field.type !== "relation" && isFieldVisible(field, model.raw)).map((field) => field.name));
   if (!sortableFields.has(sort)) throw new RequestValidationError(`Field "${sort}" cannot be used for sorting.`);
   if (dir !== "asc" && dir !== "desc") throw new RequestValidationError("Query parameter \"dir\" must be either \"asc\" or \"desc\".");

   const fieldsByName = new Map(meta.fields.map((field) => [field.name, field]));
   const filterableFields = new Set(model.resolved.listFilter.filter((fieldName) => {
      const field = fieldsByName.get(fieldName);
      return field !== undefined && field.type !== "relation" && isFieldVisible(field, model.raw);
   }));
   const filters: FieldFilters = {};
   const knownQueryParameters = new Set(["page", "sort", "dir", "search"]);

   for (const [parameterName, rawValue] of Object.entries(query)) {
      if (knownQueryParameters.has(parameterName)) continue;
      if (typeof rawValue !== "string") throw new RequestValidationError(`Query parameter "${parameterName}" must be a single string value.`);

      const rangeMatch = /^(.*)_(gte|lte)$/.exec(parameterName);
      const fieldName = rangeMatch?.[1] ?? parameterName;
      const field = fieldsByName.get(fieldName);
      if (!field || !filterableFields.has(fieldName)) throw new RequestValidationError(`Filter "${parameterName}" is not allowed for this model.`);

      if (rangeMatch) {
         if (field.type !== "datetime") throw new RequestValidationError(`Filter "${parameterName}" is only supported for date-time fields.`);
         const operator = rangeMatch[2];
         if (operator !== "gte" && operator !== "lte") throw new RequestValidationError(`Filter "${parameterName}" is invalid.`);
         const existing = filters[fieldName];
         const range: { gte?: Date | number; lte?: Date | number } =
            existing && !("equals" in existing) && !("in" in existing) ? { ...existing } : {};
         range[operator] = parseFilterValue(field, rawValue) as Date;
         filters[fieldName] = range;
      } else {
         filters[fieldName] = { equals: parseFilterValue(field, rawValue) };
      }
   }

   const searchValue = getQueryValue(query, "search")?.trim();
   if (searchValue && searchValue.length > 200) throw new RequestValidationError("Query parameter \"search\" must be 200 characters or fewer.");
   const searchFields = model.resolved.searchFields.filter((fieldName) => {
      const field = fieldsByName.get(fieldName);
      return field?.type === "string" && isFieldVisible(field, model.raw);
   });
   if (searchValue && searchFields.length === 0) throw new RequestValidationError(`Model "${meta.name}" has no searchable fields.`);

   const search: SearchQuery | undefined = searchValue
      ? { text: searchValue, fields: searchFields }
      : undefined;

   return { page: pageValue, sort, dir, filters, search };
}
