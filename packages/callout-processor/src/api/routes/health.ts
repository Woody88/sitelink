export function healthHandler(isReady: boolean): Response {
  if (isReady) {
    return Response.json({
      status: "ready",
      service: "callout-processor",
    })
  }
  return Response.json(
    {
      status: "initializing",
      service: "callout-processor",
    },
    { status: 503 }
  )
}
