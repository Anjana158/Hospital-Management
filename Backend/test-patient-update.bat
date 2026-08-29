@echo off
REM Patient Update Test Suite using curl

setlocal enabledelayedexpansion

set BASE_URL=http://localhost:5000/api
set TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoidXNlcjEwMDAiLCJyb2xlIjoiUkVDRVBUSU9OIiwiaWF0IjoxNzg3OTc3MzQ1fQ.xeY7bUAb8epp-Fi5mpDKzk7E8pxw7SqBDPUNEDEtgZI

echo === PATIENT UPDATE TEST SUITE ===
echo.

REM TEST 1: Register patient
echo TEST 1: Register base patient...
curl -s -X POST "%BASE_URL%/patients" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"firstName\":\"John\",\"lastName\":\"Doe\",\"phone\":\"+1-234-567-8901\",\"gender\":\"MALE\",\"categoryId\":1}" > temp.json

for /f "tokens=2 delims=:," %%a in ('findstr "\"id\":" temp.json ^| findstr /v "categoryId"') do (
  set PATIENT_ID=%%a
  set PATIENT_ID=!PATIENT_ID:,=!
)
echo Patient registered: ID=!PATIENT_ID!
echo.

REM TEST 2: Update single field
echo TEST 2: Update single field (firstName)...
curl -s -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"firstName\":\"Jonathan\"}"
echo.
echo.

REM TEST 3: Update multiple fields
echo TEST 3: Update multiple fields...
curl -s -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"lastName\":\"Smith\",\"email\":\"john@example.com\",\"city\":\"New York\"}"
echo.
echo.

REM TEST 4: Phone normalization
echo TEST 4: Phone formatting normalization...
curl -s -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"(234) 567-8901\"}"
echo.
echo.

REM TEST 5: Register second patient
echo TEST 5: Register second patient for duplicate phone test...
curl -s -X POST "%BASE_URL%/patients" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"firstName\":\"Jane\",\"lastName\":\"Doe\",\"phone\":\"9876543210\",\"categoryId\":1}" > temp2.json

for /f "tokens=2 delims=:," %%a in ('findstr "\"id\":" temp2.json ^| findstr /v "categoryId"') do (
  set PATIENT_ID2=%%a
  set PATIENT_ID2=!PATIENT_ID2:,=!
)
echo Patient 2 registered: ID=!PATIENT_ID2!
echo.

REM TEST 6: Duplicate phone detection
echo TEST 6: Duplicate phone detection (should fail with 409)...
curl -i -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"9876543210\"}"
echo.
echo.

REM TEST 7: Self-duplicate exclusion (same phone)
echo TEST 7: Self-duplicate exclusion (phone unchanged)...
curl -s -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"2345678901\"}"
echo.
echo.

REM TEST 8: Same primary and alternate phone
echo TEST 8: Reject same primary and alternate phone (should fail with 400)...
curl -i -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"1111111111\",\"alternatePhone\":\"1111111111\"}"
echo.
echo.

REM TEST 9: Invalid category
echo TEST 9: Invalid category ID=999 (should fail with 400)...
curl -i -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"categoryId\":999}"
echo.
echo.

REM TEST 10: Nonexistent patient
echo TEST 10: Nonexistent patient ID=99999 (should fail with 404)...
curl -i -X PATCH "%BASE_URL%/patients/99999" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"firstName\":\"Test\"}"
echo.
echo.

REM TEST 11: Invalid ID (non-numeric)
echo TEST 11: Invalid patient ID=abc (should fail with 400)...
curl -i -X PATCH "%BASE_URL%/patients/abc" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"firstName\":\"Test\"}"
echo.
echo.

REM TEST 12: Immutable field (UHID)
echo TEST 12: Reject immutable field uhid (should fail with 400)...
curl -i -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"uhid\":\"NEWHID\"}"
echo.
echo.

REM TEST 13: Unknown field
echo TEST 13: Reject unknown field (should fail with 400)...
curl -i -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"firstName\":\"Test\",\"unknownField\":\"value\"}"
echo.
echo.

REM TEST 14: No editable fields
echo TEST 14: No editable fields provided (should fail with 400)...
curl -i -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{}"
echo.
echo.

REM TEST 15: Unauthorized (no token)
echo TEST 15: Unauthorized without JWT token (should fail with 401)...
curl -i -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Content-Type: application/json" ^
  -d "{\"firstName\":\"Test\"}"
echo.
echo.

REM TEST 16: Clear optional fields
echo TEST 16: Clear optional fields with empty string...
curl -s -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"\",\"addressLine1\":\"\"}"
echo.
echo.

REM TEST 17: Update dateOfBirth
echo TEST 17: Update dateOfBirth with valid date...
curl -s -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"dateOfBirth\":\"1990-05-15\"}"
echo.
echo.

REM TEST 18: Reject future dateOfBirth
echo TEST 18: Reject future dateOfBirth (should fail with 400)...
curl -i -X PATCH "%BASE_URL%/patients/!PATIENT_ID!" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -H "Content-Type: application/json" ^
  -d "{\"dateOfBirth\":\"2030-01-01\"}"
echo.
echo.

echo === ALL TESTS COMPLETE ===

del temp.json temp2.json 2>nul

endlocal
