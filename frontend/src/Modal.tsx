import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Окно поверх страницы: на телефоне выезжает снизу, на компьютере по центру.
 * Рисуется через портал в body, поэтому его можно открывать и поверх другого окна (top — самый верхний слой).
 * Закрывается по Esc и клику на затемнение; страница под окном не прокручивается, фокус возвращается назад.
 */
export default function Modal(props: { title: string; onClose: () => void; children: ReactNode; top?: boolean }) {
  const { title, onClose, children, top } = props
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current?.querySelector<HTMLElement>('input,select')
    first?.focus()
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!top && document.querySelector('[data-top-modal]')) return // Esc сначала закрывает верхнее окно
      onClose()
    }
    window.addEventListener('keydown', k)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', k)
      prevFocus?.focus?.()
    }
  }, [])

  return createPortal(
    <>
      <div className={'modal-bd' + (top ? ' top' : '')} onClick={onClose} />
      <div className={'modal' + (top ? ' top' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}
        {...(top ? { 'data-top-modal': '' } : {})}>
        <h2>{title}</h2>
        {children}
      </div>
    </>,
    document.body,
  )
}
