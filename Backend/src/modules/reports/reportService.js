const { prisma } = require("../../config/prisma");

const VALID_GENDERS = ["MALE", "FEMALE", "TRANSGENDER"];
const VALID_AGE_GROUPS = ["0-13", "13-18", "18+"];

function toNumber(value, fallback = undefined) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeGender(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const normalized = String(value).trim().toUpperCase();
    return VALID_GENDERS.includes(normalized) ? normalized : undefined;
}

function normalizeAgeGroup(value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const normalized = String(value).trim();
    return VALID_AGE_GROUPS.includes(normalized) ? normalized : undefined;
}

function parseLocalDate(value) {
    if (!value) {
        return null;
    }

    const input = String(value).trim();
    const match = /^\d{4}-\d{2}-\d{2}$/.test(input);

    if (!match) {
        const error = new Error("Invalid date format. Please use YYYY-MM-DD.");
        error.code = "REPORT_VALIDATION_ERROR";
        throw error;
    }

    const [year, month, day] = input.split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);

    if (Number.isNaN(parsedDate.getTime())) {
        const error = new Error("Invalid date value provided.");
        error.code = "REPORT_VALIDATION_ERROR";
        throw error;
    }

    return parsedDate;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function getStartOfWeek(date) {
    const start = startOfDay(date);
    const day = start.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + diff);
}

function formatDate(date) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date);
}

function formatDisplayDateTime(date) {
    return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function formatRangeLabel(period, startDate, endDate, month, year) {
    if (period === "daily") {
        return `Daily - ${formatDate(startDate)}`;
    }

    if (period === "weekly") {
        return `Weekly - ${formatDate(startDate)} to ${formatDate(endDate)}`;
    }

    if (period === "monthly") {
        const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(year, month - 1, 1));
        return `${monthName} ${year}`;
    }

    return `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

function createEmptyDepartmentRow(department) {
    return {
        departmentId: department.id,
        departmentName: department.name,
        newVisits: 0,
        reVisits: 0,
        male: 0,
        female: 0,
        transgender: 0,
        totalVisits: 0,
        age0To13: 0,
        age13To18: 0,
        ageAbove18: 0,
    };
}

function getAgeGroup(ageValue) {
    const age = Number(ageValue);

    if (!Number.isFinite(age)) {
        return null;
    }

    if (age <= 13) {
        return "0-13";
    }

    if (age <= 18) {
        return "13-18";
    }

    return "18+";
}

function resolveAgeFromPatient(patient) {
    if (patient && Number.isFinite(Number(patient.age))) {
        return Number(patient.age);
    }

    if (patient && patient.dateOfBirth) {
        const dob = new Date(patient.dateOfBirth);
        if (!Number.isNaN(dob.getTime())) {
            const today = new Date();
            let computedAge = today.getFullYear() - dob.getFullYear();
            const monthDifference = today.getMonth() - dob.getMonth();

            if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dob.getDate())) {
                computedAge -= 1;
            }

            return computedAge;
        }
    }

    return null;
}

function roundAmount(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

async function getVisitFinancialSummary(where) {
    const [totals, cashTotals, gpayTotals, posTotals, freeVisits] = await Promise.all([
        prisma.patientVisit.aggregate({
            where,
            _sum: { opFee: true, discountAmount: true, finalFee: true },
        }),
        prisma.patientVisit.aggregate({
            where: { ...where, paymentStatus: "PAID", paymentMethod: "CASH" },
            _sum: { finalFee: true },
        }),
        prisma.patientVisit.aggregate({
            where: { ...where, paymentStatus: "PAID", paymentMethod: "GPAY" },
            _sum: { finalFee: true },
        }),
        prisma.patientVisit.aggregate({
            where: { ...where, paymentStatus: "PAID", paymentMethod: "POS" },
            _sum: { finalFee: true },
        }),
        prisma.patientVisit.count({
            where: { ...where, paymentStatus: "FREE" },
        }),
    ]);

    const cashAmount = roundAmount(cashTotals._sum.finalFee);
    const posAmount = roundAmount(Number(gpayTotals._sum.finalFee || 0) + Number(posTotals._sum.finalFee || 0));
    const totalCollected = roundAmount(cashAmount + posAmount);
    const discountAmount = roundAmount(totals._sum.discountAmount);
    const grandTotal = roundAmount(discountAmount + totalCollected);

    return {
        grandTotal,
        discountAmount,
        totalCollected,
        cashAmount,
        posAmount,
        freeOpVisits: freeVisits,
    };
}

function getAgeGroupFilter(ageGroup) {
    if (!ageGroup) {
        return undefined;
    }

    if (ageGroup === "0-13") {
        return { gte: 0, lte: 13 };
    }

    if (ageGroup === "13-18") {
        return { gt: 13, lte: 18 };
    }

    if (ageGroup === "18+") {
        return { gt: 18 };
    }

    return undefined;
}

function buildDateRange(period, date, week, month, year, fromDate, toDate) {
    const baseDate = parseLocalDate(date) || new Date();

    if (period === "daily") {
        const startDate = startOfDay(baseDate);
        const endDate = endOfDay(baseDate);

        return {
            startDate,
            endDate,
            label: formatRangeLabel(period, startDate, endDate),
            periodLabel: "Daily",
            month: baseDate.getMonth() + 1,
            year: baseDate.getFullYear(),
        };
    }

    if (period === "weekly") {
        const selectedDate = parseLocalDate(date) || baseDate;
        const startDate = getStartOfWeek(selectedDate);
        const endDate = endOfDay(addDays(startDate, 6));

        return {
            startDate,
            endDate,
            label: formatRangeLabel(period, startDate, endDate),
            periodLabel: "Weekly",
            month: startDate.getMonth() + 1,
            year: startDate.getFullYear(),
        };
    }

    if (period === "monthly") {
        const targetMonth = toNumber(month, baseDate.getMonth() + 1);
        const targetYear = toNumber(year, baseDate.getFullYear());

        const startDate = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        return {
            startDate,
            endDate,
            label: formatRangeLabel(period, startDate, endDate, targetMonth, targetYear),
            periodLabel: "Monthly",
            month: targetMonth,
            year: targetYear,
        };
    }

    const fromValue = parseLocalDate(fromDate);
    const toValue = parseLocalDate(toDate);

    if (!fromValue || !toValue) {
        const error = new Error("Custom date range requires both from and to dates.");
        error.code = "REPORT_RANGE_ERROR";
        throw error;
    }

    if (fromValue > toValue) {
        const error = new Error("From date cannot be greater than to date.");
        error.code = "REPORT_RANGE_ERROR";
        throw error;
    }

    return {
        startDate: startOfDay(fromValue),
        endDate: endOfDay(toValue),
        label: `${formatDate(startOfDay(fromValue))} to ${formatDate(endOfDay(toValue))}`,
        periodLabel: "Custom Date Range",
        month: fromValue.getMonth() + 1,
        year: fromValue.getFullYear(),
    };
}

async function generateReceptionistReport(query, loggedInUserId) {
    const period = String(query.period || "daily").trim().toLowerCase();
    const validPeriods = ["daily", "weekly", "monthly", "custom"];

    if (!validPeriods.includes(period)) {
        const error = new Error("Invalid report period selected.");
        error.code = "REPORT_VALIDATION_ERROR";
        throw error;
    }

    const receptionistId = Number(loggedInUserId);

    if (!Number.isInteger(receptionistId) || receptionistId < 1) {
        const error = new Error("Authenticated receptionist is invalid.");
        error.code = "REPORT_VALIDATION_ERROR";
        throw error;
    }

    const selectedGender = normalizeGender(query.gender);
    const selectedAgeGroup = normalizeAgeGroup(query.ageGroup);
    const selectedDepartmentId = toNumber(query.departmentId);
    const selectedVisitType = String(query.visitType || "").trim().toUpperCase();

    if (selectedVisitType && !["NEW", "REVISIT"].includes(selectedVisitType)) {
        const error = new Error("Visit type filter is invalid.");
        error.code = "REPORT_VALIDATION_ERROR";
        throw error;
    }

    const range = buildDateRange(
        period,
        query.date,
        query.week,
        query.month,
        query.year,
        query.fromDate,
        query.toDate
    );

    const allDepartments = await prisma.department.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
    });

    const departmentRows = new Map(allDepartments.map((department) => [department.id, createEmptyDepartmentRow(department)]));

    const patientFilter = {};

    if (selectedGender) {
        patientFilter.gender = selectedGender;
    }

    if (selectedAgeGroup) {
        patientFilter.age = getAgeGroupFilter(selectedAgeGroup);
    }

    const whereClause = {
        createdBy: receptionistId,
        visitDate: {
            gte: range.startDate,
            lte: range.endDate,
        },
        status: { not: "CANCELLED" },
        ...(selectedDepartmentId ? { departmentId: selectedDepartmentId } : {}),
        ...(Object.keys(patientFilter).length > 0 ? { patient: patientFilter } : {}),
        ...(selectedVisitType ? { visitType: selectedVisitType } : {}),
    };

    const [visits, financialSummary] = await Promise.all([
        prisma.patientVisit.findMany({
            where: whereClause,
            select: {
                id: true,
                visitDate: true,
                visitType: true,
                departmentId: true,
                department: {
                    select: { id: true, name: true },
                },
                patient: {
                    select: {
                        gender: true,
                        age: true,
                        dateOfBirth: true,
                    },
                },
            },
            orderBy: [{ departmentId: "asc" }, { visitDate: "asc" }],
        }),
        getVisitFinancialSummary(whereClause),
    ]);

    visits.forEach((visit) => {
        const departmentId = visit.departmentId;
        const departmentName = visit.department?.name || "Unknown Department";

        if (!departmentRows.has(departmentId)) {
            departmentRows.set(departmentId, {
                departmentId,
                departmentName,
                newVisits: 0,
                reVisits: 0,
                male: 0,
                female: 0,
                transgender: 0,
                totalVisits: 0,
                age0To13: 0,
                age13To18: 0,
                ageAbove18: 0,
            });
        }

        const row = departmentRows.get(departmentId);
        const patientAge = resolveAgeFromPatient(visit.patient);
        const ageBucket = getAgeGroup(patientAge);
        const patientGender = visit.patient?.gender || null;

        if (visit.visitType === "NEW") {
            row.newVisits += 1;
        } else if (visit.visitType === "REVISIT") {
            row.reVisits += 1;
        }

        if (patientGender === "MALE") {
            row.male += 1;
        } else if (patientGender === "FEMALE") {
            row.female += 1;
        } else if (patientGender === "TRANSGENDER") {
            row.transgender += 1;
        }

        row.totalVisits += 1;

        if (ageBucket === "0-13") {
            row.age0To13 += 1;
        } else if (ageBucket === "13-18") {
            row.age13To18 += 1;
        } else if (ageBucket === "18+") {
            row.ageAbove18 += 1;
        }
    });

    const departmentSummary = Array.from(departmentRows.values()).sort((a, b) => a.departmentName.localeCompare(b.departmentName));

    const totals = departmentSummary.reduce((acc, row) => {
        acc.newVisits += row.newVisits;
        acc.reVisits += row.reVisits;
        acc.male += row.male;
        acc.female += row.female;
        acc.transgender += row.transgender;
        acc.totalVisits += row.totalVisits;
        acc.age0To13 += row.age0To13;
        acc.age13To18 += row.age13To18;
        acc.ageAbove18 += row.ageAbove18;
        return acc;
    }, {
        newVisits: 0,
        reVisits: 0,
        male: 0,
        female: 0,
        transgender: 0,
        totalVisits: 0,
        age0To13: 0,
        age13To18: 0,
        ageAbove18: 0,
    });

    const report = {
        hospitalName: "GENERAL HOSPITAL THRISSUR",
        title: "Receptionist Patient Registration Report",
        period: {
            type: period,
            label: range.periodLabel,
            rangeLabel: range.label,
            startDate: range.startDate,
            endDate: range.endDate,
        },
        filters: {
            gender: selectedGender || "All",
            departmentId: selectedDepartmentId || null,
            departmentName: selectedDepartmentId
                ? allDepartments.find((department) => department.id === selectedDepartmentId)?.name || "Selected Department"
                : "All Departments",
            ageGroup: selectedAgeGroup || "All",
            visitType: selectedVisitType || "All",
        },
        generatedAt: new Date().toISOString(),
        summary: { ...totals, ...financialSummary },
        departments: departmentSummary,
        hasRecords: visits.length > 0,
    };

    return report;
}

async function generateAdminReceptionReport(query) {
    const period = String(query.period || "daily").trim().toLowerCase();
    const validPeriods = ["daily", "weekly", "monthly", "custom"];

    if (!validPeriods.includes(period)) {
        const error = new Error("Invalid report period selected.");
        error.code = "REPORT_VALIDATION_ERROR";
        throw error;
    }

    const selectedGender = normalizeGender(query.gender);
    const selectedAgeGroup = normalizeAgeGroup(query.ageGroup);
    const selectedDepartmentId = toNumber(query.departmentId);
    const selectedReceptionistId = query.receptionistId && query.receptionistId !== "all"
        ? Number(query.receptionistId)
        : undefined;
    const selectedVisitType = String(query.visitType || "").trim().toUpperCase();

    if (selectedReceptionistId !== undefined && (!Number.isInteger(selectedReceptionistId) || selectedReceptionistId < 1)) {
        const error = new Error("Receptionist filter is invalid.");
        error.code = "REPORT_VALIDATION_ERROR";
        throw error;
    }

    if (selectedVisitType && !["NEW", "REVISIT"].includes(selectedVisitType)) {
        const error = new Error("Visit type filter is invalid.");
        error.code = "REPORT_VALIDATION_ERROR";
        throw error;
    }

    const range = buildDateRange(
        period,
        query.date,
        query.week,
        query.month,
        query.year,
        query.fromDate,
        query.toDate
    );
    const patientFilter = {};

    if (selectedGender) {
        patientFilter.gender = selectedGender;
    }

    if (selectedAgeGroup) {
        patientFilter.age = getAgeGroupFilter(selectedAgeGroup);
    }

    const where = {
        visitDate: {
            gte: range.startDate,
            lte: range.endDate,
        },
        status: { not: "CANCELLED" },
        ...(selectedReceptionistId ? { createdBy: selectedReceptionistId } : {}),
        ...(selectedDepartmentId ? { departmentId: selectedDepartmentId } : {}),
        ...(Object.keys(patientFilter).length ? { patient: patientFilter } : {}),
        ...(selectedVisitType ? { visitType: selectedVisitType } : {}),
    };

    const [visits, visitTotals, receptionistGroups, departmentGroups, visitTypeGroups, departments, receptionists, financialSummary] = await Promise.all([
        prisma.patientVisit.findMany({
            where,
            select: {
                id: true,
                patientId: true,
                visitDate: true,
                visitType: true,
                departmentId: true,
                createdBy: true,
                opFee: true,
                discountAmount: true,
                finalFee: true,
                department: { select: { id: true, name: true } },
                createdByUser: { select: { id: true, fullName: true } },
                patient: {
                    select: {
                        uhid: true,
                        firstName: true,
                        dateOfBirth: true,
                        age: true,
                        gender: true,
                        phone: true,
                        createdBy: true,
                        createdByUser: { select: { id: true, fullName: true } },
                        scheme: { select: { id: true, name: true, code: true } },
                    },
                },
            },
            orderBy: [{ visitDate: "desc" }, { id: "desc" }],
        }),
        prisma.patientVisit.aggregate({
            where,
            _count: { _all: true },
        }),
        prisma.patientVisit.groupBy({
            by: ["createdBy"],
            where,
            _count: { _all: true },
            _sum: { finalFee: true },
        }),
        prisma.patientVisit.groupBy({
            by: ["departmentId"],
            where,
            _count: { _all: true },
            _sum: { finalFee: true },
        }),
        prisma.patientVisit.groupBy({
            by: ["visitType"],
            where,
            _count: { _all: true },
            _sum: { finalFee: true, discountAmount: true },
        }),
        prisma.department.findMany({
            where: { status: "ACTIVE" },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
        }),
        prisma.user.findMany({
            where: { userRoles: { some: { role: { name: "RECEPTION" } } } },
            orderBy: { fullName: "asc" },
            select: { id: true, fullName: true },
        }),
        getVisitFinancialSummary(where),
    ]);

    const roundAmount = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
    const amountByReceptionist = new Map(receptionistGroups.map((row) => [row.createdBy, row]));
    const receptionistById = new Map(receptionists.map((user) => [user.id, user]));
    const receptionistBreakdown = Array.from(amountByReceptionist, ([id, row]) => ({
        receptionistId: id,
        receptionistName: receptionistById.get(id)?.fullName || "Unknown Receptionist",
        totalVisits: row._count._all,
        totalAmount: roundAmount(row._sum.finalFee),
    })).sort((a, b) => a.receptionistName.localeCompare(b.receptionistName));

    const departmentById = new Map(departments.map((department) => [department.id, {
        departmentId: department.id,
        departmentName: department.name,
        totalVisits: 0,
        totalAmount: 0,
    }]));
    departmentGroups.forEach((row) => {
        const department = departmentById.get(row.departmentId) || {
            departmentId: row.departmentId,
            departmentName: "Unknown Department",
            totalVisits: 0,
            totalAmount: 0,
        };
        department.totalVisits = row._count._all;
        department.totalAmount = roundAmount(row._sum.finalFee);
        departmentById.set(row.departmentId, department);
    });

    const visitTypeByName = new Map(visitTypeGroups.map((row) => [row.visitType, row]));
    const genderCounts = { MALE: 0, FEMALE: 0, TRANSGENDER: 0 };
    const ageCounts = { "0-13": 0, "13-18": 0, "18+": 0 };
    const schemeById = new Map();
    const patientIds = new Set();

    visits.forEach((visit) => {
        patientIds.add(visit.patientId);
        const gender = visit.patient?.gender;
        if (genderCounts[gender] !== undefined) genderCounts[gender] += 1;

        const ageGroup = getAgeGroup(resolveAgeFromPatient(visit.patient));
        if (ageGroup && ageCounts[ageGroup] !== undefined) ageCounts[ageGroup] += 1;

        const schemeId = visit.schemeIdAtVisit ?? visit.patient?.scheme?.id ?? null;
        const schemeName = visit.schemeNameAtVisit || visit.patient?.scheme?.name || "No Scheme";
        const schemeRow = schemeById.get(schemeId) || {
            schemeId,
            schemeName,
            totalVisits: 0,
            opAmount: 0,
            totalDiscount: 0,
            totalAmount: 0,
        };
        schemeRow.totalVisits += 1;
        schemeRow.opAmount += Number(visit.opFee || 0);
        schemeRow.totalDiscount += Number(visit.discountAmount || 0);
        schemeRow.totalAmount += Number(visit.finalFee || 0);
        schemeById.set(schemeId, schemeRow);

        const department = departmentById.get(visit.departmentId);
        if (department) {
            department.newVisits = (department.newVisits || 0) + (visit.visitType === "NEW" ? 1 : 0);
            department.reVisits = (department.reVisits || 0) + (visit.visitType === "REVISIT" ? 1 : 0);
        }
    });

    const detailRows = visits.map((visit) => {
        const patient = visit.patient;
        return {
            visitId: visit.id,
            visitDate: visit.visitDate,
            visitType: visit.visitType,
            patientId: visit.patientId,
            patientName: patient.firstName,
            uhid: patient.uhid,
            phone: patient.phone,
            gender: patient.gender,
            age: resolveAgeFromPatient(patient),
            department: visit.department?.name || "Unknown Department",
            scheme: patient.scheme?.name || "No Scheme",
            schemeCode: patient.scheme?.code || null,
            opFee: roundAmount(visit.opFee),
            discountAmount: roundAmount(visit.discountAmount),
            finalFee: roundAmount(visit.finalFee),
            receptionist: visit.createdByUser?.fullName || "Unknown Receptionist",
            patientRegisteredBy: patient.createdByUser?.fullName || "Unknown Receptionist",
        };
    });

    const newVisits = visitTypeByName.get("NEW")?._count._all || 0;
    const reVisits = visitTypeByName.get("REVISIT")?._count._all || 0;
    const summary = {
        totalPatients: patientIds.size,
        totalVisits: visitTotals._count._all,
        newVisits,
        reVisits,
        male: genderCounts.MALE,
        female: genderCounts.FEMALE,
        transgender: genderCounts.TRANSGENDER,
        age0To13: ageCounts["0-13"],
        age13To18: ageCounts["13-18"],
        ageAbove18: ageCounts["18+"],
        ...financialSummary,
    };

    return {
        hospitalName: "GENERAL HOSPITAL THRISSUR",
        title: "Admin Reception Activity Report",
        period: {
            type: period,
            label: range.periodLabel,
            rangeLabel: range.label,
            startDate: range.startDate,
            endDate: range.endDate,
        },
        filters: {
            receptionistId: selectedReceptionistId || null,
            receptionistName: selectedReceptionistId
                ? receptionistById.get(selectedReceptionistId)?.fullName || "Selected Receptionist"
                : "All Receptionists",
            gender: selectedGender || "All",
            departmentId: selectedDepartmentId || null,
            departmentName: selectedDepartmentId
                ? departments.find((department) => department.id === selectedDepartmentId)?.name || "Selected Department"
                : "All Departments",
            ageGroup: selectedAgeGroup || "All",
            visitType: selectedVisitType || "All",
        },
        generatedAt: new Date().toISOString(),
        summary,
        breakdowns: {
            receptionists: receptionistBreakdown,
            gender: Object.entries(genderCounts).map(([gender, count]) => ({ gender, count })),
            ageGroups: Object.entries(ageCounts).map(([ageGroup, count]) => ({ ageGroup, count })),
            departments: Array.from(departmentById.values()).sort((a, b) => a.departmentName.localeCompare(b.departmentName)),
            visitTypes: ["NEW", "REVISIT"].map((visitType) => {
                const row = visitTypeByName.get(visitType);
                return {
                    visitType,
                    totalVisits: row?._count._all || 0,
                    totalAmount: roundAmount(row?._sum.finalFee),
                    totalDiscount: roundAmount(row?._sum.discountAmount),
                };
            }),
            schemes: Array.from(schemeById.values()).map((row) => ({
                ...row,
                opAmount: roundAmount(row.opAmount),
                totalDiscount: roundAmount(row.totalDiscount),
                totalAmount: roundAmount(row.totalAmount),
            })).sort((a, b) => a.schemeName.localeCompare(b.schemeName)),
        },
        receptionists,
        visits: detailRows,
        hasRecords: visits.length > 0,
    };
}

module.exports = {
    generateReceptionistReport,
    generateAdminReceptionReport,
};
