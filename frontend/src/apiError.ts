/** Ошибка запроса: status — код ответа сервера (0 — нет связи). По нему i18n выбирает сообщение для пользователя. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}
