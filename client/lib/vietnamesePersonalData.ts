export const isValidGmailAddress = (email: string) => /^[^\s@]+@gmail\.com$/i.test(email.trim());

export const isValidVietnamesePhone = (phone: string) => /^0\d{9}$/.test(phone.trim());

export const isValidVietnameseIdentityNumber = (value: string) => /^\d{12}$/.test(value.trim());
