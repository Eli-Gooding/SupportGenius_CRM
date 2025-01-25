/**
 * Generates a secure password with specified requirements
 * @returns A string containing the generated password
 */
export function generatePassword(): string {
  const length = 12
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  
  // Ensure at least one of each required character type
  password += getRandomChar('ABCDEFGHIJKLMNOPQRSTUVWXYZ') // uppercase
  password += getRandomChar('abcdefghijklmnopqrstuvwxyz') // lowercase
  password += getRandomChar('0123456789') // number
  password += getRandomChar('!@#$%^&*') // special
  
  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

function getRandomChar(charset: string): string {
  return charset[Math.floor(Math.random() * charset.length)]
} 