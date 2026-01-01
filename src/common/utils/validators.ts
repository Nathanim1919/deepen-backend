/**
 * Validates API key formats for different services
 */
export const validateApiKey = {
    gemini: (key: string): boolean => {
      return /^AIza[0-9A-Za-z-_]{35}$/.test(key);
    },
    openai: (key: string): boolean => {
      return /^sk-[0-9a-zA-Z]{32,}$/.test(key);
    },
    // Add other service validators as needed
  };
  
  /**
   * Validates email format
   */
  export const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };
  
  /**
   * Validates password strength
   */
  export const validatePassword = (password: string): boolean => {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number
    const re = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
    return re.test(password);
  };