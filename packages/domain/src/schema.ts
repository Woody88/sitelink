// packages/domain/src/schema.ts
import { makeSchema, State } from "@livestore/livestore"
import { events } from "./events"
import { tables } from "./tables"
import { materializers } from "./materializers"

const state = State.SQLite.makeState({ tables, materializers })

export const schema = makeSchema({ events, state })
