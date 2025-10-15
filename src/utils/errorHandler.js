export class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export const handleApiError = (error) => {
  if (error.message === 'Требуется повторная авторизация') {
    return 'Сессия истекла. Пожалуйста, войдите снова.';
  }
  
  if (error.code === 'NETWORK_ERROR') {
    return 'Ошибка соединения с сервером. Проверьте интернет-соединение.';
  }
  
  return error.message || 'Произошла неизвестная ошибка';
};