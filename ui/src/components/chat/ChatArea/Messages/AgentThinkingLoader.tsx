const AgentThinkingLoader = () => (
  <div
    className="flex items-center gap-2 py-0.5 text-muted-foreground/70"
    role="status"
    aria-label="Assistant is working"
  >
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="size-1.5 rounded-full bg-primary/50 [animation-delay:-0.3s] [animation-duration:0.7s] motion-safe:animate-bounce" />
      <span className="size-1.5 rounded-full bg-primary/50 [animation-delay:-0.15s] [animation-duration:0.7s] motion-safe:animate-bounce" />
      <span className="size-1.5 rounded-full bg-primary/50 [animation-duration:0.7s] motion-safe:animate-bounce" />
    </span>
    <span className="text-xs motion-safe:animate-pulse">Working on it…</span>
  </div>
)

export default AgentThinkingLoader
