// utils/dateUtils.js

/**
 * Formats a date object to a human-readable date string
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string (e.g., "Monday, January 1, 2025")
 */
exports.formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Converts 24-hour time format to 12-hour format with AM/PM
 * @param {string} timeString - Time in 24-hour format (e.g., "14:30")
 * @returns {string} - Time in 12-hour format (e.g., "2:30 PM")
 */
exports.formatTime = (timeString) => {
  if (!timeString || typeof timeString !== "string") {
    return "";
  }

  // Convert 24-hour format to 12-hour format
  const [hours, minutes] = timeString.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
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
