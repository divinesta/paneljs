import { Router } from "express";
import {
  parseListQuery,
  type AdminService,
  type FullRegisteredModel,
} from "paneljs";

import {
  getAdminUser,
  getRecordId,
  getRegisteredModel,
  route,
} from "./routeSupport.js";

/** Express transport for framework-neutral core CRUD operations. */
export function createCrudRouter(
  models: Map<string, FullRegisteredModel>,
  service: AdminService,
): Router {
  const router = Router();

  router.get(
    "/:model",
    route(async (req, res) => {
      const model = getRegisteredModel(req, res, models);
      const adminUser = getAdminUser(req, res);
      if (!model || !adminUser) return;
      const { page, sort, dir, filters, search } = parseListQuery(
        req.query as Record<string, string | string[] | undefined>,
        model.meta,
        model,
      );
      res.json(
        await service.list(model, adminUser, {
          page,
          filters,
          search,
          sort: { field: sort, direction: dir },
        }),
      );
    }),
  );

  router.get(
    "/:model/:id",
    route(async (req, res) => {
      const model = getRegisteredModel(req, res, models);
      const adminUser = getAdminUser(req, res);
      if (!model || !adminUser) return;
      res.json(
        await service.get(model, adminUser, getRecordId(req, model.meta)),
      );
    }),
  );

  router.post(
    "/:model",
    route(async (req, res) => {
      const model = getRegisteredModel(req, res, models);
      const adminUser = getAdminUser(req, res);
      if (!model || !adminUser) return;
      res.status(201).json(await service.create(model, adminUser, req.body));
    }),
  );

  router.put(
    "/:model/:id",
    route(async (req, res) => {
      const model = getRegisteredModel(req, res, models);
      const adminUser = getAdminUser(req, res);
      if (!model || !adminUser) return;
      res.json(
        await service.update(
          model,
          adminUser,
          getRecordId(req, model.meta),
          req.body,
        ),
      );
    }),
  );

  router.delete(
    "/:model/:id",
    route(async (req, res) => {
      const model = getRegisteredModel(req, res, models);
      const adminUser = getAdminUser(req, res);
      if (!model || !adminUser) return;
      await service.delete(model, adminUser, getRecordId(req, model.meta));
      res.status(204).end();
    }),
  );

  return router;
}
