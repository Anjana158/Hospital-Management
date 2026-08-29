#!/usr/bin/env pwsh

# Configuration
$BASE_URL = "http://localhost:5000/api"
$TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoidXNlcjEwMDAiLCJyb2xlIjoiUkVDRVBUSU9OIiwiaWF0IjoxNzg3OTc3MzQ1fQ.xeY7bUAb8epp-Fi5mpDKzk7E8pxw7SqBDPUNEDEtgZI"
$HEADERS = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

Write-Host "=== PATIENT UPDATE TEST SUITE ===" -ForegroundColor Cyan
Write-Host ""

# TEST 1: Register a patient
Write-Host "TEST 1: Register base patient..." -ForegroundColor Yellow
$body = @{
    firstName = "John"
    lastName = "Doe"
    phone = "+1-234-567-8901"
    gender = "MALE"
    categoryId = 1
} | ConvertTo-Json

$reg = Invoke-WebRequest -Uri "$BASE_URL/patients" -Method POST -Headers $HEADERS -Body $body -ErrorAction Stop
$patient = $reg.Content | ConvertFrom-Json
$patientId = $patient.data.id
Write-Host "✓ Patient registered: ID=$patientId, UHID=$($patient.data.uhid)" -ForegroundColor Green
Write-Host ""

# TEST 2: Update single field
Write-Host "TEST 2: Update single field (firstName)..." -ForegroundColor Yellow
$body = @{ firstName = "Jonathan" } | ConvertTo-Json
$res = Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
$updated = $res.Content | ConvertFrom-Json
Write-Host "✓ Success: firstName=$($updated.data.firstName)" -ForegroundColor Green
Write-Host ""

# TEST 3: Update multiple fields
Write-Host "TEST 3: Update multiple fields..." -ForegroundColor Yellow
$body = @{
    lastName = "Smith"
    email = "john@example.com"
    city = "New York"
} | ConvertTo-Json
$res = Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
$updated = $res.Content | ConvertFrom-Json
Write-Host "✓ Success: lastName=$($updated.data.lastName), email=$($updated.data.email), city=$($updated.data.city)" -ForegroundColor Green
Write-Host ""

# TEST 4: Phone normalization
Write-Host "TEST 4: Phone formatting normalization..." -ForegroundColor Yellow
$body = @{ phone = "(234) 567-8901" } | ConvertTo-Json
$res = Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
$updated = $res.Content | ConvertFrom-Json
$phone = $updated.data.phone
Write-Host "✓ Success: normalized phone=$phone" -ForegroundColor Green
Write-Host ""

# TEST 5: Register second patient
Write-Host "TEST 5: Register second patient for duplicate phone test..." -ForegroundColor Yellow
$body = @{
    firstName = "Jane"
    lastName = "Doe"
    phone = "9876543210"
    categoryId = 1
} | ConvertTo-Json
$res = Invoke-WebRequest -Uri "$BASE_URL/patients" -Method POST -Headers $HEADERS -Body $body -ErrorAction Stop
$patient2 = $res.Content | ConvertFrom-Json
$patientId2 = $patient2.data.id
Write-Host "✓ Patient 2 registered: ID=$patientId2" -ForegroundColor Green
Write-Host ""

# TEST 6: Duplicate phone detection
Write-Host "TEST 6: Duplicate phone detection (should fail)..." -ForegroundColor Yellow
$body = @{ phone = "9876543210" } | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have rejected duplicate" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        $err = $_.Content | ConvertFrom-Json
        Write-Host "✓ Success: Got 409 with $($err.duplicates.Count) candidate(s)" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 7: Self-duplicate exclusion
Write-Host "TEST 7: Self-duplicate exclusion (phone unchanged)..." -ForegroundColor Yellow
$body = @{ phone = $phone } | ConvertTo-Json
$res = Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
Write-Host "✓ Success: Patient allowed to keep same phone" -ForegroundColor Green
Write-Host ""

# TEST 8: Same primary and alternate phone
Write-Host "TEST 8: Reject same primary and alternate phone..." -ForegroundColor Yellow
$body = @{
    phone = "1111111111"
    alternatePhone = "1111111111"
} | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have rejected same primary/alternate" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        $err = $_.Content | ConvertFrom-Json
        Write-Host "✓ Success: Got 400 - $($err.message)" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 9: Invalid category
Write-Host "TEST 9: Invalid/inactive category (ID 999)..." -ForegroundColor Yellow
$body = @{ categoryId = 999 } | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have rejected invalid category" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        $err = $_.Content | ConvertFrom-Json
        Write-Host "✓ Success: Got 400 - $($err.message)" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 10: Nonexistent patient
Write-Host "TEST 10: Nonexistent patient (ID 99999)..." -ForegroundColor Yellow
$body = @{ firstName = "Test" } | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/99999" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have returned 404" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✓ Success: Got 404" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 11: Invalid ID
Write-Host "TEST 11: Invalid patient ID (non-numeric)..." -ForegroundColor Yellow
$body = @{ firstName = "Test" } | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/abc" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have returned 400" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✓ Success: Got 400" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 12: Immutable field (UHID)
Write-Host "TEST 12: Reject immutable field (uhid)..." -ForegroundColor Yellow
$body = @{ uhid = "NEWHID" } | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have rejected uhid" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        $err = $_.Content | ConvertFrom-Json
        Write-Host "✓ Success: Got 400 - $($err.message)" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 13: Unknown field
Write-Host "TEST 13: Reject unknown field..." -ForegroundColor Yellow
$body = @{
    firstName = "Test"
    unknownField = "value"
} | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have rejected unknown field" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        $err = $_.Content | ConvertFrom-Json
        Write-Host "✓ Success: Got 400 - $($err.message)" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 14: No fields provided
Write-Host "TEST 14: No editable fields provided..." -ForegroundColor Yellow
$body = @{} | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have rejected empty update" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        $err = $_.Content | ConvertFrom-Json
        Write-Host "✓ Success: Got 400 - $($err.message)" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 15: Unauthorized (no token)
Write-Host "TEST 15: Unauthorized (no JWT token)..." -ForegroundColor Yellow
$headersNoToken = @{ "Content-Type" = "application/json" }
$body = @{ firstName = "Test" } | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $headersNoToken -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have returned 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✓ Success: Got 401" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

# TEST 16: Clear optional fields
Write-Host "TEST 16: Clear optional fields with empty string..." -ForegroundColor Yellow
$body = @{
    email = ""
    addressLine1 = ""
} | ConvertTo-Json
$res = Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
$updated = $res.Content | ConvertFrom-Json
$emailStr = if ($updated.data.email -eq $null) { "null" } else { $updated.data.email }
$addr1Str = if ($updated.data.addressLine1 -eq $null) { "null" } else { $updated.data.addressLine1 }
Write-Host "✓ Success: email=$emailStr, addressLine1=$addr1Str" -ForegroundColor Green
Write-Host ""

# TEST 17: Update dateOfBirth valid
Write-Host "TEST 17: Update dateOfBirth with valid date..." -ForegroundColor Yellow
$body = @{ dateOfBirth = "1990-05-15" } | ConvertTo-Json
$res = Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
$updated = $res.Content | ConvertFrom-Json
Write-Host "✓ Success: dateOfBirth=$($updated.data.dateOfBirth)" -ForegroundColor Green
Write-Host ""

# TEST 18: Reject future dateOfBirth
Write-Host "TEST 18: Reject future dateOfBirth..." -ForegroundColor Yellow
$body = @{ dateOfBirth = "2030-01-01" } | ConvertTo-Json
try {
    Invoke-WebRequest -Uri "$BASE_URL/patients/$patientId" -Method PATCH -Headers $HEADERS -Body $body -ErrorAction Stop
    Write-Host "✗ ERROR: Should have rejected future date" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        $err = $_.Content | ConvertFrom-Json
        Write-Host "✓ Success: Got 400 - $($err.message)" -ForegroundColor Green
    } else {
        Write-Host "✗ ERROR: Wrong status $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "=== ALL TESTS COMPLETE ===" -ForegroundColor Cyan
