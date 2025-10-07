// utils/dateUtils.js

/**
 * Formats a date object to a Polish date string
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string (e.g., "1 stycznia 2025")
 */
exports.formatDate = (date) => {
  return new Date(date).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * Formats a date object to DD.MM.YYYY format for SMS
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string (e.g., "01.01.2025")
 */
exports.formatDateForSMS = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

/**
 * Formats time to Polish 24-hour format
 * @param {string} timeString - Time in 24-hour format (e.g., "14:30")
 * @returns {string} - Time in Polish format (e.g., "14:30")
 */
exports.formatTime = (timeString) => {
  if (!timeString || typeof timeString !== "string") {
    return "";
  }

  // Return time in 24-hour format as is (Polish standard)
  return timeString;
};

/**
 * Formats time to HH:MM format for SMS (keeps colon)
 * @param {string} timeString - Time in 24-hour format (e.g., "14:30")
 * @returns {string} - Time in HH:MM format (e.g., "14:30")
 */
exports.formatTimeForSMS = (timeString) => {
  if (!timeString || typeof timeString !== "string") {
    return "";
  }

  // Return time as-is with colon (HH:MM format)
  return timeString;
};

/**
 * Calculates the duration between two time strings in minutes
 * @param {string} startTime - Start time in 24-hour format (e.g., "14:30")
 * @param {string} endTime - End time in 24-hour format (e.g., "15:45")
 * @returns {number} - Duration in minutes
 */
exports.calculateDuration = (startTime, endTime) => {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
};

/**
 * Adds a specified number of minutes to a time string
 * @param {string} timeString - Time in 24-hour format (e.g., "14:30")
 * @param {number} minutesToAdd - Minutes to add
 * @returns {string} - Resulting time in 24-hour format
 */
exports.addMinutesToTime = (timeString, minutesToAdd) => {
  const [hours, minutes] = timeString.split(":").map(Number);

  // Create a date object and set hours and minutes
  const date = new Date();
  date.setHours(hours, minutes + minutesToAdd, 0, 0);

  // Extract the new hours and minutes
  const newHours = date.getHours().toString().padStart(2, "0");
  const newMinutes = date.getMinutes().toString().padStart(2, "0");

  return `${newHours}:${newMinutes}`;
};


exports.calculateAge = (dateOfBirth) => {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
}
