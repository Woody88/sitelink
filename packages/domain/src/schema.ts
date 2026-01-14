// packages/domain/src/schema.ts
import { makeSchema, State } from "@livestore/livestore";
import { events } from "./events";
import { materializers } from "./materializers";
import { tables } from "./tables";

const state = State.SQLite.makeState({ tables, materializers });

export const schema = makeSchema({ events, state });
