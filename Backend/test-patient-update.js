const jwt = require('jsonwebtoken');
const axios = require('axios');

const token = jwt.sign({ userId: 2, username: 'user1000', role: 'RECEPTION' }, 'secret_key');
const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    headers: { Authorization: 'Bearer ' + token }
});

(async () => {
    console.log('=== PATIENT UPDATE TEST SUITE ===\n');

    try {
        // TEST 1: Register a patient for testing
        console.log('TEST 1: Register base patient...');
        const registerRes = await api.post('/patients', {
            firstName: 'John',
            lastName: 'Doe',
            phone: '+1-234-567-8901',
            gender: 'MALE',
            categoryId: 1
        });
        const patientId = registerRes.data.data.id;
        console.log('✓ Patient registered: ID=' + patientId + ', UHID=' + registerRes.data.data.uhid + '\n');

        // TEST 2: Update single field
        console.log('TEST 2: Update single field (firstName)...');
        const t2Res = await api.patch('/patients/' + patientId, { firstName: 'Jonathan' });
        console.log('✓ Success: firstName=' + t2Res.data.data.firstName + '\n');

        // TEST 3: Update multiple fields
        console.log('TEST 3: Update multiple fields...');
        const t3Res = await api.patch('/patients/' + patientId, {
            lastName: 'Smith',
            email: 'john@example.com',
            city: 'New York'
        });
        console.log('✓ Success: lastName=' + t3Res.data.data.lastName + ', email=' + t3Res.data.data.email + ', city=' + t3Res.data.data.city + '\n');

        // TEST 4: Phone normalization
        console.log('TEST 4: Phone formatting normalization...');
        const t4Res = await api.patch('/patients/' + patientId, { phone: '(234) 567-8901' });
        console.log('✓ Success: normalized phone=' + t4Res.data.data.phone + '\n');

        // TEST 5: Register another patient for duplicate test
        console.log('TEST 5: Register second patient for duplicate phone test...');
        const p2Res = await api.post('/patients', {
            firstName: 'Jane',
            lastName: 'Doe',
            phone: '9876543210',
            categoryId: 1
        });
        const patientId2 = p2Res.data.data.id;
        console.log('✓ Patient 2 registered: ID=' + patientId2 + '\n');

        // TEST 6: Duplicate phone detection (should fail)
        console.log('TEST 6: Duplicate phone detection (should fail)...');
        try {
            await api.patch('/patients/' + patientId, { phone: '9876543210' });
            console.log('✗ ERROR: Should have rejected duplicate\n');
        } catch (e) {
            if (e.response.status === 409) {
                console.log('✓ Success: Got 409 with ' + e.response.data.duplicates.length + ' candidate(s)\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 7: Self-duplicate exclusion
        console.log('TEST 7: Self-duplicate exclusion (phone unchanged)...');
        const currentPhone = t4Res.data.data.phone;
        const t7Res = await api.patch('/patients/' + patientId, { phone: currentPhone });
        console.log('✓ Success: Patient allowed to keep same phone\n');

        // TEST 8: Same number as primary and alternate
        console.log('TEST 8: Reject same primary and alternate phone...');
        try {
            await api.patch('/patients/' + patientId, { phone: '1111111111', alternatePhone: '1111111111' });
            console.log('✗ ERROR: Should have rejected same primary/alternate\n');
        } catch (e) {
            if (e.response.status === 400) {
                console.log('✓ Success: Got 400 - ' + e.response.data.message + '\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 9: Invalid/inactive category
        console.log('TEST 9: Invalid/inactive category (ID 999)...');
        try {
            await api.patch('/patients/' + patientId, { categoryId: 999 });
            console.log('✗ ERROR: Should have rejected invalid category\n');
        } catch (e) {
            if (e.response.status === 400) {
                console.log('✓ Success: Got 400 - ' + e.response.data.message + '\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 10: Nonexistent patient
        console.log('TEST 10: Nonexistent patient (ID 99999)...');
        try {
            await api.patch('/patients/99999', { firstName: 'Test' });
            console.log('✗ ERROR: Should have returned 404\n');
        } catch (e) {
            if (e.response.status === 404) {
                console.log('✓ Success: Got 404\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 11: Invalid ID
        console.log('TEST 11: Invalid patient ID (non-numeric)...');
        try {
            await api.patch('/patients/abc', { firstName: 'Test' });
            console.log('✗ ERROR: Should have returned 400\n');
        } catch (e) {
            if (e.response.status === 400) {
                console.log('✓ Success: Got 400\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 12: Immutable field (UHID)
        console.log('TEST 12: Reject immutable field (uhid)...');
        try {
            await api.patch('/patients/' + patientId, { uhid: 'NEWHID' });
            console.log('✗ ERROR: Should have rejected uhid\n');
        } catch (e) {
            if (e.response.status === 400) {
                console.log('✓ Success: Got 400 - ' + e.response.data.message + '\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 13: Unknown field
        console.log('TEST 13: Reject unknown field...');
        try {
            await api.patch('/patients/' + patientId, { firstName: 'Test', unknownField: 'value' });
            console.log('✗ ERROR: Should have rejected unknown field\n');
        } catch (e) {
            if (e.response.status === 400) {
                console.log('✓ Success: Got 400 - ' + e.response.data.message + '\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 14: No fields provided
        console.log('TEST 14: No editable fields provided...');
        try {
            await api.patch('/patients/' + patientId, {});
            console.log('✗ ERROR: Should have rejected empty update\n');
        } catch (e) {
            if (e.response.status === 400) {
                console.log('✓ Success: Got 400 - ' + e.response.data.message + '\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 15: Unauthorized (no token)
        console.log('TEST 15: Unauthorized (no JWT token)...');
        try {
            const apiNoToken = axios.create({ baseURL: 'http://localhost:5000/api' });
            await apiNoToken.patch('/patients/' + patientId, { firstName: 'Test' });
            console.log('✗ ERROR: Should have returned 401\n');
        } catch (e) {
            if (e.response.status === 401) {
                console.log('✓ Success: Got 401\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        // TEST 16: Optional fields cleared with empty string
        console.log('TEST 16: Clear optional fields with empty string...');
        const t16Res = await api.patch('/patients/' + patientId, { email: '', addressLine1: '' });
        console.log('✓ Success: email=' + (t16Res.data.data.email === null ? 'null' : t16Res.data.data.email) + ', addressLine1=' + (t16Res.data.data.addressLine1 === null ? 'null' : t16Res.data.data.addressLine1) + '\n');

        // TEST 17: dateOfBirth valid
        console.log('TEST 17: Update dateOfBirth with valid date...');
        const t17Res = await api.patch('/patients/' + patientId, { dateOfBirth: '1990-05-15' });
        console.log('✓ Success: dateOfBirth=' + t17Res.data.data.dateOfBirth + '\n');

        // TEST 18: dateOfBirth future (should fail)
        console.log('TEST 18: Reject future dateOfBirth...');
        try {
            await api.patch('/patients/' + patientId, { dateOfBirth: '2030-01-01' });
            console.log('✗ ERROR: Should have rejected future date\n');
        } catch (e) {
            if (e.response.status === 400) {
                console.log('✓ Success: Got 400 - ' + e.response.data.message + '\n');
            } else {
                console.log('✗ ERROR: Wrong status ' + e.response.status + '\n');
            }
        }

        console.log('=== ALL TESTS COMPLETE ===');
        process.exit(0);
    } catch (err) {
        console.error('Test error:', err.message);
        if (err.response) {
            console.error('Response:', err.response.data);
        }
        process.exit(1);
    }
})();
