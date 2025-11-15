import { Effect, Schema } from "effect";
import { TileGenerationQueue } from "../bindings";

export class QueueError extends Schema.TaggedError<QueueError>()(
	"QueueError",
	{
		cause: Schema.Defect,
	},
) {}

export class QueueService extends Effect.Service<QueueService>()("QueueService", {
	effect: Effect.gen(function* () {
		const queue = yield* TileGenerationQueue

		const send = Effect.fn("QueueService.send")(function* (
			message: unknown,
		) {
			return yield* Effect.tryPromise({
				try: () => queue.send(message),
				catch: (cause) => new QueueError({ cause }),
			})
		})

		const sendBatch = Effect.fn("QueueService.sendBatch")(function* (
			messages: Iterable<MessageSendRequest<unknown>>,
		) {
			return yield* Effect.tryPromise({
				try: () => queue.sendBatch(messages),
				catch: (cause) => new QueueError({ cause }),
			})
		})

    return { send, sendBatch } as const
	}),
}) {}
