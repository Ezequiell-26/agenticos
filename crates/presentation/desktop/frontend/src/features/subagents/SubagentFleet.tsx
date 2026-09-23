import SubagentBuilder from './SubagentBuilder'

export default function SubagentFleet({ onAction }: { onAction: (message: string) => void }) {
  return <SubagentBuilder onAction={onAction} />
}
