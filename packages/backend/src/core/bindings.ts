import { Context } from "effect"
import type { Resend } from "resend"

export class D1Binding extends Context.Tag("D1Binding")<
	D1Binding,
	D1Database
>() {}

export class ResendBinding extends Context.Tag("ResendBinding")<
	ResendBinding,
	Resend
>() {}
