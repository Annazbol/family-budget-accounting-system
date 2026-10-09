/** Переключатель из нескольких кнопок (период, язык, тема, вид списка). */
export default function Seg<T extends string>(props: {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
  label?: string
}) {
  return (
    <div className="seg" role="group" aria-label={props.label}>
      {props.options.map(([v, l]) => (
        <button key={v} type="button" className={v === props.value ? 'on' : ''} aria-pressed={v === props.value}
          onClick={() => props.onChange(v)}>{l}</button>
      ))}
    </div>
  )
}
