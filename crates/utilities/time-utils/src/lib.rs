//! Time utilities (based on chrono MIT/Apache-2.0 patterns)
//! MIT/Apache-2.0 Licensed - Date and time library for Rust
//! Source: https://github.com/chronotope/chrono (33,288 dependents, MIT/Apache-2.0)

use chrono::{DateTime, Utc, Local, Duration, NaiveDateTime, NaiveDate, TimeZone, Datelike};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TimeError {
    #[error("Invalid time format: {0}")]
    InvalidFormat(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Timezone error: {0}")]
    TimezoneError(String),
}

/// Get current UTC timestamp
pub fn utc_now() -> DateTime<Utc> {
    Utc::now()
}

/// Get current local timestamp
pub fn local_now() -> DateTime<Local> {
    Local::now()
}

/// Format datetime to ISO 8601 string
pub fn format_iso8601(dt: &DateTime<Utc>) -> String {
    dt.to_rfc3339()
}

/// Parse ISO 8601 string to datetime
pub fn parse_iso8601(s: &str) -> Result<DateTime<Utc>, TimeError> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| TimeError::ParseError(e.to_string()))
}

/// Convert timestamp (seconds since epoch) to DateTime
pub fn from_timestamp(timestamp: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(timestamp, 0).unwrap_or_else(Utc::now)
}

/// Convert timestamp with milliseconds to DateTime
pub fn from_timestamp_millis(timestamp: i64) -> DateTime<Utc> {
    DateTime::from_timestamp_millis(timestamp).unwrap_or_else(Utc::now)
}

/// Convert DateTime to timestamp (seconds since epoch)
pub fn to_timestamp(dt: &DateTime<Utc>) -> i64 {
    dt.timestamp()
}

/// Convert DateTime to timestamp with milliseconds
pub fn to_timestamp_millis(dt: &DateTime<Utc>) -> i64 {
    dt.timestamp_millis()
}

/// Calculate duration between two datetimes
pub fn duration_between(start: &DateTime<Utc>, end: &DateTime<Utc>) -> Duration {
    *end - *start
}

/// Add duration to datetime
pub fn add_duration(dt: &DateTime<Utc>, duration: Duration) -> DateTime<Utc> {
    *dt + duration
}

/// Subtract duration from datetime
pub fn sub_duration(dt: &DateTime<Utc>, duration: Duration) -> DateTime<Utc> {
    *dt - duration
}

/// Format datetime with custom format
pub fn format_custom(dt: &DateTime<Utc>, format: &str) -> String {
    dt.format(format).to_string()
}

/// Parse datetime with custom format
pub fn parse_custom(s: &str, format: &str) -> Result<DateTime<Utc>, TimeError> {
    NaiveDateTime::parse_from_str(s, format)
        .map(|dt| Utc.from_utc_datetime(&dt))
        .map_err(|e| TimeError::ParseError(e.to_string()))
}

/// Format date to YYYY-MM-DD
pub fn format_date(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d").to_string()
}

/// Format time to HH:MM:SS
pub fn format_time(dt: &DateTime<Utc>) -> String {
    dt.format("%H:%M:%S").to_string()
}

/// Format datetime to YYYY-MM-DD HH:MM:SS
pub fn format_datetime(dt: &DateTime<Utc>) -> String {
    dt.format("%Y-%m-%d %H:%M:%S").to_string()
}

/// Check if datetime is in the past
pub fn is_past(dt: &DateTime<Utc>) -> bool {
    *dt < Utc::now()
}

/// Check if datetime is in the future
pub fn is_future(dt: &DateTime<Utc>) -> bool {
    *dt > Utc::now()
}

/// Get start of day
pub fn start_of_day(dt: &DateTime<Utc>) -> DateTime<Utc> {
    let date = dt.date_naive();
    let start = date.and_hms_opt(0, 0, 0).unwrap();
    Utc.from_utc_datetime(&start)
}

/// Get end of day
pub fn end_of_day(dt: &DateTime<Utc>) -> DateTime<Utc> {
    let date = dt.date_naive();
    let end = date.and_hms_opt(23, 59, 59).unwrap();
    Utc.from_utc_datetime(&end)
}

/// Get start of week (Monday)
pub fn start_of_week(dt: &DateTime<Utc>) -> DateTime<Utc> {
    let date = dt.date_naive();
    let weekday = date.weekday().num_days_from_monday();
    let start_date = date - Duration::days(weekday as i64);
    let start = start_date.and_hms_opt(0, 0, 0).unwrap();
    Utc.from_utc_datetime(&start)
}

/// Get start of month
pub fn start_of_month(dt: &DateTime<Utc>) -> DateTime<Utc> {
    let date = dt.date_naive();
    let year = date.year();
    let month = date.month();
    let start_date = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let start = start_date.and_hms_opt(0, 0, 0).unwrap();
    Utc.from_utc_datetime(&start)
}

/// Get end of month
pub fn end_of_month(dt: &DateTime<Utc>) -> DateTime<Utc> {
    let date = dt.date_naive();
    let year = date.year();
    let month = date.month();
    let next_month = if month == 12 { 1 } else { month + 1 };
    let next_year = if month == 12 { year + 1 } else { year };
    let next_month_date = NaiveDate::from_ymd_opt(next_year, next_month, 1).unwrap();
    let end_date = next_month_date - Duration::days(1);
    let end = end_date.and_hms_opt(23, 59, 59).unwrap();
    Utc.from_utc_datetime(&end)
}

/// Get days between two dates
pub fn days_between(start: &DateTime<Utc>, end: &DateTime<Utc>) -> i64 {
    (*end - *start).num_days()
}

/// Get hours between two datetimes
pub fn hours_between(start: &DateTime<Utc>, end: &DateTime<Utc>) -> i64 {
    (*end - *start).num_hours()
}

/// Get minutes between two datetimes
pub fn minutes_between(start: &DateTime<Utc>, end: &DateTime<Utc>) -> i64 {
    (*end - *start).num_minutes()
}

/// Get seconds between two datetimes
pub fn seconds_between(start: &DateTime<Utc>, end: &DateTime<Utc>) -> i64 {
    (*end - *start).num_seconds()
}

/// Get milliseconds between two datetimes
pub fn millis_between(start: &DateTime<Utc>, end: &DateTime<Utc>) -> i64 {
    (*end - *start).num_milliseconds()
}

/// Timer utility for measuring elapsed time
pub struct Timer {
    start: DateTime<Utc>,
}

impl Timer {
    pub fn new() -> Self {
        Self {
            start: Utc::now(),
        }
    }

    pub fn elapsed(&self) -> Duration {
        Utc::now() - self.start
    }

    pub fn elapsed_millis(&self) -> i64 {
        self.elapsed().num_milliseconds()
    }

    pub fn elapsed_seconds(&self) -> i64 {
        self.elapsed().num_seconds()
    }

    pub fn reset(&mut self) {
        self.start = Utc::now();
    }
}

impl Default for Timer {
    fn default() -> Self {
        Self::new()
    }
}

/// Deadline utility for timeout
pub struct Deadline {
    deadline: DateTime<Utc>,
}

impl Deadline {
    pub fn from_now(duration: Duration) -> Self {
        Self {
            deadline: Utc::now() + duration,
        }
    }

    pub fn from_datetime(dt: DateTime<Utc>) -> Self {
        Self { deadline: dt }
    }

    pub fn remaining(&self) -> Duration {
        let now = Utc::now();
        if now < self.deadline {
            self.deadline - now
        } else {
            Duration::zero()
        }
    }

    pub fn is_expired(&self) -> bool {
        Utc::now() >= self.deadline
    }

    pub fn time_remaining_millis(&self) -> i64 {
        self.remaining().num_milliseconds()
    }
}

/// Convert UTC to local timezone
pub fn utc_to_local(dt: &DateTime<Utc>) -> DateTime<Local> {
    dt.with_timezone(&Local)
}

/// Convert local timezone to UTC
pub fn local_to_utc(dt: &DateTime<Local>) -> DateTime<Utc> {
    dt.with_timezone(&Utc)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_utc_now() {
        let now = utc_now();
        assert!(now.timestamp() > 0);
    }

    #[test]
    fn test_format_iso8601() {
        let dt = utc_now();
        let formatted = format_iso8601(&dt);
        assert!(formatted.len() > 0);
    }

    #[test]
    fn test_parse_iso8601() {
        let dt = utc_now();
        let formatted = format_iso8601(&dt);
        let parsed = parse_iso8601(&formatted).unwrap();
        assert_eq!(dt.timestamp(), parsed.timestamp());
    }

    #[test]
    fn test_from_timestamp() {
        let timestamp = 1234567890;
        let dt = from_timestamp(timestamp);
        assert_eq!(dt.timestamp(), timestamp);
    }

    #[test]
    fn test_to_timestamp() {
        let dt = utc_now();
        let timestamp = to_timestamp(&dt);
        assert!(timestamp > 0);
    }

    #[test]
    fn test_duration_between() {
        let start = utc_now();
        let end = start + Duration::seconds(10);
        let duration = duration_between(&start, &end);
        assert_eq!(duration.num_seconds(), 10);
    }

    #[test]
    fn test_add_duration() {
        let dt = utc_now();
        let result = add_duration(&dt, Duration::seconds(5));
        assert_eq!(duration_between(&dt, &result).num_seconds(), 5);
    }

    #[test]
    fn test_format_date() {
        let dt = utc_now();
        let formatted = format_date(&dt);
        assert!(formatted.len() == 10); // YYYY-MM-DD
    }

    #[test]
    fn test_format_time() {
        let dt = utc_now();
        let formatted = format_time(&dt);
        assert!(formatted.len() == 8); // HH:MM:SS
    }

    #[test]
    fn test_is_past() {
        let past = utc_now() - Duration::seconds(10);
        assert!(is_past(&past));
    }

    #[test]
    fn test_is_future() {
        let future = utc_now() + Duration::seconds(10);
        assert!(is_future(&future));
    }

    #[test]
    fn test_start_of_day() {
        let dt = utc_now();
        let start = start_of_day(&dt);
        let formatted = format_time(&start);
        assert_eq!(formatted, "00:00:00");
    }

    #[test]
    fn test_end_of_day() {
        let dt = utc_now();
        let end = end_of_day(&dt);
        let formatted = format_time(&end);
        assert_eq!(formatted, "23:59:59");
    }

    #[test]
    fn test_timer() {
        let timer = Timer::new();
        std::thread::sleep(std::time::Duration::from_millis(100));
        let elapsed = timer.elapsed_millis();
        assert!(elapsed >= 100);
    }

    #[test]
    fn test_deadline() {
        let deadline = Deadline::from_now(Duration::seconds(1));
        assert!(!deadline.is_expired());
        std::thread::sleep(std::time::Duration::from_millis(1100));
        assert!(deadline.is_expired());
    }

    #[test]
    fn test_days_between() {
        let start = utc_now();
        let end = start + Duration::days(5);
        assert_eq!(days_between(&start, &end), 5);
    }
}
