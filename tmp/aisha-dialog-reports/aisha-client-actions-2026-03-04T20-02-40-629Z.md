# Aisha Dialog Regression

- Suite: `client-actions`
- Base URL: `http://localhost:3000`
- Account: `severnaya-orhideya`
- Started: 2026-03-04T20:02:37.458Z
- Finished: 2026-03-04T20:02:40.628Z
- Duration ms: 3170
- Result: FAIL

## PASS - Client my bookings flow handles auth/result
- [OK] 1. какая у меня ближайшая запись

## PASS - Client past bookings flow handles auth/result
- [OK] 1. какая у меня прошедшая запись

## PASS - Client stats flow handles auth/result
- [OK] 1. моя статистика

## FAIL - Client cancel flow handles auth/result
- [FAIL] 1. отмени мою ближайшую запись
  - Error: Client cancel flow handles auth/result / step 1 (отмени мою ближайшую запись): expected one of /отмен|подтверж|авторизац|личн|не нашл/i
reply:
выберите филиал (локацию), и продолжу запись.

