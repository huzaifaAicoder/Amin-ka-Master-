import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/** Authentication plus the Student learning-role boundary for private learner data and actions. */
export const studentProcedure = protectedProcedure.use(
  t.middleware(({ ctx, next }) => {
    if (!ctx.user || ctx.user.role !== "student") {
      throw new TRPCError({ code: "FORBIDDEN", message: "This action is available only in the student learning experience." });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);

export const requireRoles = (roles: Array<"developer" | "teacher" | "admin" | "super_admin">) =>
  protectedProcedure.use(
    t.middleware(({ ctx, next }) => {
      if (!ctx.user || !roles.includes(ctx.user.role as (typeof roles)[number])) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission for this operation" });
      }
      return next({ ctx: { ...ctx, user: ctx.user } });
    }),
  );

export const ownerProcedure = requireRoles(["super_admin"]);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || !["admin", "super_admin"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
