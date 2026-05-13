type ClassroomObjectProps = {
  className: string
  label?: string
  children?: React.ReactNode
}

export function ClassroomObject({ className, label, children }: ClassroomObjectProps) {
  return (
    <div className={`classroom-object ${className}`} aria-label={label}>
      {children}
    </div>
  )
}
