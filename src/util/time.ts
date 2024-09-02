const SECONDS_A_MINUTE = 60;
const SECONDS_A_HOUR = SECONDS_A_MINUTE * 60;
const SECONDS_A_DAY = SECONDS_A_HOUR * 24;
const SECONDS_A_WEEK = SECONDS_A_DAY * 7;
const SECONDS_A_MONTH = SECONDS_A_DAY * 30;
const SECONDS_A_YEAR = SECONDS_A_WEEK * 52;

export const formatTime = (seconds: number) => {
  if (seconds >= SECONDS_A_YEAR) {
    return `${(seconds / SECONDS_A_YEAR).toFixed(1)} yrs`;
  }
  if (seconds >= SECONDS_A_MONTH) {
    return `${(seconds / SECONDS_A_MONTH).toFixed(1)} mos`;
  }
  if (seconds >= SECONDS_A_WEEK) {
    return `${(seconds / SECONDS_A_WEEK).toFixed(1)} wks`;
  }
  if (seconds >= SECONDS_A_DAY) {
    return `${(seconds / SECONDS_A_DAY).toFixed(1)} days`;
  }
  if (seconds >= SECONDS_A_HOUR) {
    return `${(seconds / SECONDS_A_HOUR).toFixed(1)} hrs`;
  }
  if (seconds >= SECONDS_A_MINUTE) {
    return `${(seconds / SECONDS_A_MINUTE).toFixed(1)} min`;
  } else {
    return `${seconds}s`;
  }
};
