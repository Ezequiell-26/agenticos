import type { SVGProps } from 'react'

export type IconName =
  | 'activity'
  | 'archive'
  | 'arrow-down'
  | 'arrow-up'
  | 'bot'
  | 'branch'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'clock'
  | 'code'
  | 'command'
  | 'copy'
  | 'folder'
  | 'git'
  | 'history'
  | 'layout'
  | 'message'
  | 'more'
  | 'paperclip'
  | 'play'
  | 'plus'
  | 'search'
  | 'send'
  | 'settings'
  | 'shield'
  | 'spark'
  | 'stop'
  | 'terminal'
  | 'tool'
  | 'x'

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

const paths: Record<IconName, string[]> = {
  activity: ['M3 12h4l2-8 4 16 2-8h6'],
  archive: ['M4 7h16', 'M5 7l1 13h12l1-13', 'M8 11h8', 'M7 4h10v3H7z'],
  'arrow-down': ['M12 4v14', 'm7 13 5 5 5-5'],
  'arrow-up': ['M12 20V6', 'm7 11 5-5 5 5'],
  bot: ['M8 8h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z', 'M12 4v4', 'M9 13h.01', 'M15 13h.01', 'M9 16h6'],
  branch: ['M6 3v10a4 4 0 0 0 4 4h8', 'M14 8l4 4-4 4', 'M6 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  check: ['m5 12 4 4L19 6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  clock: ['M12 7v5l3 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  code: ['m8 9-3 3 3 3', 'm16 9 3 3-3 3', 'm14 6-4 12'],
  command: ['M18 7V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2', 'M6 17a2 2 0 1 0 4 0V8', 'M14 12h6', 'M17 9v6'],
  copy: ['M9 9h10v10H9z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  folder: ['M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  git: ['M6 4v6a2 2 0 0 0 2 2h8a2 2 0 0 1 2 2v2', 'M6 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z', 'M18 4a2 2 0 1 0 0 4 2 2 0 0 0-4 4Z'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 5v5h5'],
  layout: ['M4 5h16v14H4z', 'M9 5v14', 'M15 5v14'],
  message: ['M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-1-2z'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  paperclip: ['m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7'],
  play: ['m8 5 11 7-11 7z'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['m20 20-4.5-4.5', 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z'],
  send: ['m21 4-8 16-4-7-7-4z', 'm21 4-12 9'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M19.1 4.9l-1.4 1.4', 'M6.3 17.7l-1.4 1.4', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2'],
  shield: ['M12 3 19 6v5c0 4.5-2.8 7.5-7 10-4.2-2.5-7-5.5-7-10V6z', 'm9 12 2 2 4-4'],
  spark: ['m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z', 'M19 16v5', 'M21.5 18.5h-5'],
  stop: ['M6 6h12v12H6z'],
  terminal: ['m5 7 5 5-5 5', 'M12 17h7', 'M4 4h16v16H4z'],
  tool: ['M14 6a4 4 0 1 0 4 4l3 3-3 3-3-3', 'M8 14 3 19'],
  x: ['M6 6l12 12', 'M18 6 6 18'],
}

export default function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width={size} {...props}>
      {paths[name].map((path, index) => <path d={path} key={index} />)}
    </svg>
  )
}
