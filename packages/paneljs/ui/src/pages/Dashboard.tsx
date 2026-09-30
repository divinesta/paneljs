import { ArrowUpRight } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { Schema } from "../types";
import { formatDate } from "../utils/format";

export const Dashboard = ({ schema }: { schema: Schema }) => {
  const visibleModels = schema.models.filter(
    (model) => model.config.permissions.list,
  );
  return (
    <section className="page-section">
      <div className="eyebrow dashboard-date">{formatDate(new Date())}</div>
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p>Choose a model to manage your records.</p>
        </div>
        <span className="eyebrow">{visibleModels.length} available models</span>
      </div>
      {visibleModels.length === 0 && (
        <div className="empty-state">
          <h2>No models available</h2>
          <p>Contact your administrator to request access.</p>
        </div>
      )}
      <div className="model-cards">
        {visibleModels.map((model) => (
          <NavLink
            className="model-card"
            key={model.meta.name}
            to={`/${model.meta.pluralName}`}
          >
            <span className="model-card-icon">
              {model.meta.name.slice(0, 1)}
            </span>
            <span className="model-card-copy">
              <strong>{model.meta.name}</strong>
              <small>
                {model.meta.fields.length} fields ·{" "}
                {model.config.permissions.create ? "Can create" : "Read only"}
              </small>
            </span>
            <ArrowUpRight
              className="arrow"
              size={20}
              strokeWidth={1.75}
              aria-hidden
            />
          </NavLink>
        ))}
      </div>
    </section>
  );
};
