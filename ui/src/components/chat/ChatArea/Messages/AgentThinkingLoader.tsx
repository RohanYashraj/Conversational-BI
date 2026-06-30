const AgentThinkingLoader = () => (
  <div
    className="flex items-center justify-center gap-1"
    role="status"
    aria-label="Assistant is thinking"
  >
    <span className="motion-safe:animate-bounce size-2 rounded-full bg-primary/40 [animation-delay:-0.3s] [animation-duration:0.7s]" />
    <span className="motion-safe:animate-bounce size-2 rounded-full bg-primary/40 [animation-delay:-0.1s] [animation-duration:0.7s]" />
    <span className="motion-safe:animate-bounce size-2 rounded-full bg-primary/40 [animation-duration:0.7s]" />
  </div>
)

export default AgentThinkingLoader
