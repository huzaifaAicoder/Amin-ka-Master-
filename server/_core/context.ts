import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getSessionUser } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  sessionId?: number;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  let sessionId: number | undefined;

  try {
    const authorization = opts.req.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;
    if (token) {
      const session = await getSessionUser(token);
      user = session?.user ?? null;
      sessionId = session?.sessionId;
    }
    if (!user) user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    sessionId,
  };
}
