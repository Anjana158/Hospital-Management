const crypto = require("crypto");
const { z } = require("zod");

const { prisma } = require("../../config/prisma");
const {
    calculateAge,
    getSchemeEligibilitySnapshot,
    validateSchemeEligibility,
} = require("../patientSchemes/schemeEligibility");

const moneySchema = z.coerce.number().finite().min(0).max(99999999.99)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "Amounts may have at most two decimal places");
const serviceInputSchema = z.object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
    aplAmount: moneySchema,
    aplFree: z.boolean().default(false),
    bplAmount: moneySchema,
    bplFree: z.boolean().default(false),
}).strict();
const serviceUpdateSchema = serviceInputSchema.partial().strict();
const billInputSchema = z.object({
    patientId: z.coerce.number().int().positive(),
    category: z.enum(["APL", "BPL"]).default("APL"),
    remarks: z.string().trim().max(10000).optional().default(""),
    miscellaneousAmount: moneySchema.nullable().optional(),
    items: z.array(z.object({
        serviceId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(1000),
    }).strict()).min(1).max(100),
    paymentMethod: z.enum(["CASH", "GPAY", "POS"]).nullable().optional(),
    gpayConfirmed: z.boolean().default(false),
    posConfirmed: z.boolean().optional(),
    idempotencyKey: z.string().trim().min(8).max(100),
}).strict().superRefine((data, context) => {
    if (data.miscellaneousAmount != null && !data.remarks) {
        context.addIssue({
            code: "custom",
            message: "A remark is required when applying a miscellaneous adjustment",
            path: ["remarks"],
        });
    }
});
const billQuoteSchema = z.object({
    patientId: z.coerce.number().int().positive(),
    category: z.enum(["APL", "BPL"]).default("APL"),
    items: z.array(z.object({
        serviceId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(1000),
    }).strict()).min(1).max(100),
}).strict();
function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function cents(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw fail("BILLING_INVALID_AMOUNT", "A valid non-negative amount is required");
    }
    const result = Math.round((amount + Number.EPSILON) * 100);
    if (!Number.isSafeInteger(result) || result > 9999999999) {
        throw fail("BILLING_INVALID_AMOUNT", "Amount exceeds the supported limit");
    }
    return result;
}

function amount(centsValue) {
    return (centsValue / 100).toFixed(2);
}

function ensurePrice(amountValue, free, label) {
    if (amountValue === 0 && !free) {
        throw fail("BILLING_INVALID_TARIFF", `${label} must be explicitly marked free when its charge is zero`);
    }
    if (amountValue > 0 && free) {
        throw fail("BILLING_INVALID_TARIFF", `${label} cannot be marked free when it has a charge`);
    }
}

function dateValue(input) {
    if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        throw fail("BILLING_REPORT_VALIDATION_ERROR", "Dates must use YYYY-MM-DD format");
    }
    const [year, month, day] = input.split("-").map(Number);
    const value = new Date(year, month - 1, day);
    if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) {
        throw fail("BILLING_REPORT_VALIDATION_ERROR", "A valid date is required");
    }
    return value;
}

function buildReportRange(query) {
    const period = query.period || "daily";
    let start;
    let end;
    if (period === "custom") {
        start = dateValue(query.from);
        end = dateValue(query.to);
    } else if (period === "daily") {
        start = dateValue(query.date || localDateString());
        end = new Date(start.getTime());
    } else if (period === "weekly") {
        const selected = dateValue(query.date || localDateString());
        start = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - ((selected.getDay() + 6) % 7));
        end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    } else if (period === "monthly") {
        const month = Number(query.month || new Date().getMonth() + 1);
        const year = Number(query.year || new Date().getFullYear());
        if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2200) {
            throw fail("BILLING_REPORT_VALIDATION_ERROR", "Invalid report month or year");
        }
        start = new Date(year, month - 1, 1);
        end = new Date(year, month, 0);
    } else {
        throw fail("BILLING_REPORT_VALIDATION_ERROR", "Report period must be daily, weekly, monthly, or custom");
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (start > end || end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
        throw fail("BILLING_REPORT_VALIDATION_ERROR", "Date range is invalid or exceeds 366 days");
    }
    return { start, end, period };
}

function serviceData(service, billingCategory) {
    const tariff = service.tariffs.find((row) => row.category === billingCategory && !row.endedAt);
    if (!tariff || (Number(tariff.amount) === 0 && !tariff.isFree)) {
        throw fail("BILLING_MISSING_TARIFF", `${service.name} has no valid ${billingCategory} tariff`);
    }
    return tariff;
}

function proportionalDiscount(lines, discount) {
    const base = lines.reduce((sum, line) => sum + line.eligibleBase, 0);
    if (discount <= 0 || base <= 0) return;
    const applied = Math.min(discount, base);
    let allocated = 0;
    for (const line of lines) {
        line.schemeDiscount = Number((BigInt(applied) * BigInt(line.eligibleBase)) / BigInt(base));
        allocated += line.schemeDiscount;
    }
    for (const line of lines) {
        if (allocated >= applied) break;
        if (line.schemeDiscount < line.eligibleBase) {
            line.schemeDiscount += 1;
            allocated += 1;
        }
    }
}

function applyBillStatus(netPayable, collected) {
    if (netPayable === 0) return "WAIVED";
    if (collected === 0) return "OPEN";
    return collected >= netPayable ? "PAID" : "PARTIAL";
}

function paymentTotal(payments) {
    return payments.reduce((total, payment) => total + (payment.status === "CONFIRMED" ? cents(payment.amount) : 0), 0);
}

function initialPaymentForBill(netPayable, paymentMethod, confirmed) {
    if (netPayable === 0) {
        if (paymentMethod) {
            throw fail("BILLING_ZERO_PAYABLE", "Zero-payable bills cannot record a payment or payment method");
        }
        return null;
    }
    const normalizedMethod = normalizePaymentMethod(paymentMethod);
    if (!normalizedMethod) {
        throw fail("BILLING_PAYMENT_METHOD_REQUIRED", "Select Cash or POS for the full payment");
    }
    if (normalizedMethod === "POS" && !confirmed) {
        throw fail("BILLING_POS_CONFIRMATION_REQUIRED", "Confirm receipt of the POS payment before recording it");
    }
    return { amount: amount(netPayable), method: normalizedMethod };
}

function applyMiscellaneousAmount(netPayable, miscellaneousAmount) {
    if (miscellaneousAmount === undefined || miscellaneousAmount === null) {
        return { amount: null, discount: 0, net: netPayable };
    }
    const adjustedPayable = cents(miscellaneousAmount);
    if (adjustedPayable > netPayable) {
        throw fail("BILLING_INVALID_MISCELLANEOUS_AMOUNT", "Miscellaneous amount cannot exceed the remaining payable amount");
    }
    return {
        amount: adjustedPayable,
        discount: netPayable - adjustedPayable,
        net: adjustedPayable,
    };
}

function assertBillRequestMatches(bill, data) {
    const expectedItems = data.items
        .map((item) => `${item.serviceId}:${item.quantity}`)
        .sort();
    const actualItems = bill.items
        .map((item) => `${item.serviceId}:${item.quantity}`)
        .sort();
    const initialPayment = bill.payments.find((payment) => payment.idempotencyKey === `${data.idempotencyKey}:payment`);
    const payable = cents(bill.netPayable);
    const expectedMethod = normalizePaymentMethod(data.paymentMethod || null);
    const actualMethod = initialPayment ? normalizePaymentMethod(initialPayment.method) : null;
    const paymentMatches = payable > 0
        ? initialPayment &&
            actualMethod === expectedMethod &&
            cents(initialPayment.amount) === payable
        : !initialPayment && !expectedMethod;
    if (
        bill.patientId !== data.patientId ||
        bill.category !== data.category ||
        (bill.remarks || "") !== data.remarks ||
        (bill.miscellaneousAmount == null) !== (data.miscellaneousAmount == null) ||
        (bill.miscellaneousAmount != null && cents(bill.miscellaneousAmount) !== cents(data.miscellaneousAmount)) ||
        JSON.stringify(actualItems) !== JSON.stringify(expectedItems) ||
        !paymentMatches
    ) {
        throw fail("BILLING_IDEMPOTENCY_CONFLICT", "Bill request key has already been used for different bill details");
    }
}

function paymentEvents(payment, start, end) {
    const inRange = (value) => value && value >= start && value <= end;
    return {
        collected: Boolean(inRange(payment.confirmedAt)),
        reversed: payment.status === "REVERSED" && Boolean(inRange(payment.reversedAt)),
    };
}

function paymentEventCount(payment, start, end) {
    const events = paymentEvents(payment, start, end);
    return Number(events.collected) + Number(events.reversed);
}

async function addAudit(tx, actorId, action, entityType, entityId, details) {
    await tx.billingAudit.create({
        data: { actorId, action, entityType, entityId: String(entityId), details },
    });
}

async function listServices(isAdmin) {
    return prisma.billingService.findMany({
        where: isAdmin ? undefined : { isActive: true },
        include: {
            tariffs: { where: { endedAt: null }, select: { id: true, category: true, amount: true, isFree: true } },
        },
        orderBy: { name: "asc" },
    });
}

async function createService(input, actorId) {
    const data = serviceInputSchema.parse(input);
    ensurePrice(data.aplAmount, data.aplFree, "APL tariff");
    ensurePrice(data.bplAmount, data.bplFree, "BPL tariff");
    try {
        return await prisma.$transaction(async (tx) => {
            const service = await tx.billingService.create({
                data: {
                    name: data.name,
                    description: data.description || null,
                    isActive: data.isActive ?? true,
                    createdBy: actorId,
                    tariffs: {
                        create: [
                            { category: "APL", amount: amount(cents(data.aplAmount)), isFree: data.aplFree, createdBy: actorId },
                            { category: "BPL", amount: amount(cents(data.bplAmount)), isFree: data.bplFree, createdBy: actorId },
                        ],
                    },
                },
                include: { tariffs: { where: { endedAt: null } } },
            });
            await addAudit(tx, actorId, "SERVICE_CREATED", "SERVICE", service.id, { name: service.name });
            return service;
        });
    } catch (error) {
        if (error.code === "P2002") throw fail("BILLING_DUPLICATE_SERVICE", "A service with this name already exists");
        throw error;
    }
}

async function updateService(serviceId, input, actorId) {
    const id = Number(serviceId);
    if (!Number.isInteger(id) || id < 1) throw fail("BILLING_INVALID_SERVICE", "Invalid service id");
    const data = serviceUpdateSchema.parse(input);
    if (!Object.keys(data).length) throw fail("BILLING_INVALID_SERVICE", "Provide at least one service field to update");
    if (data.aplAmount !== undefined) ensurePrice(data.aplAmount, data.aplFree ?? false, "APL tariff");
    if (data.bplAmount !== undefined) ensurePrice(data.bplAmount, data.bplFree ?? false, "BPL tariff");
    if (data.aplFree !== undefined && data.aplAmount === undefined) throw fail("BILLING_INVALID_SERVICE", "APL amount is required when changing its free status");
    if (data.bplFree !== undefined && data.bplAmount === undefined) throw fail("BILLING_INVALID_SERVICE", "BPL amount is required when changing its free status");
    try {
        return await prisma.$transaction(async (tx) => {
            const existing = await tx.billingService.findUnique({
                where: { id },
                include: { tariffs: { where: { endedAt: null } } },
            });
            if (!existing) throw fail("BILLING_SERVICE_NOT_FOUND", "Service not found");
            const service = await tx.billingService.update({
                where: { id },
                data: {
                    ...(data.name !== undefined ? { name: data.name } : {}),
                    ...(data.description !== undefined ? { description: data.description || null } : {}),
                    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
                },
            });
            for (const category of ["APL", "BPL"]) {
                const priceKey = category === "APL" ? "aplAmount" : "bplAmount";
                const freeKey = category === "APL" ? "aplFree" : "bplFree";
                if (data[priceKey] === undefined) continue;
                const current = existing.tariffs.find((row) => row.category === category);
                if (current && cents(current.amount) === cents(data[priceKey]) && current.isFree === (data[freeKey] ?? false)) continue;
                if (current) await tx.serviceTariff.update({ where: { id: current.id }, data: { endedAt: new Date() } });
                await tx.serviceTariff.create({
                    data: {
                        serviceId: id,
                        category,
                        amount: amount(cents(data[priceKey])),
                        isFree: data[freeKey] ?? false,
                        createdBy: actorId,
                    },
                });
            }
            await addAudit(tx, actorId, "SERVICE_UPDATED", "SERVICE", id, data);
            return tx.billingService.findUnique({
                where: { id },
                include: { tariffs: { where: { endedAt: null } } },
            });
        });
    } catch (error) {
        if (error.code === "P2002") throw fail("BILLING_DUPLICATE_SERVICE", "A service with this name already exists");
        throw error;
    }
}

async function searchBillingPatients(query) {
    const q = String(query || "").trim();
    if (q.length < 2 || q.length > 100) throw fail("BILLING_PATIENT_SEARCH_ERROR", "Search must contain 2 to 100 characters");
    return prisma.patient.findMany({
        where: {
            status: "ACTIVE",
            archivedAt: null,
            OR: [
                { uhid: { contains: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
            ],
        },
        select: {
            id: true, uhid: true, firstName: true,
            age: true, dateOfBirth: true, gender: true, phone: true,
            scheme: {
                select: {
                    id: true, code: true, name: true, status: true,
                    eligibilityGender: true,
                    ageCriteriaType: true, ageLimit: true, minimumAge: true, maximumAge: true,
                    collectAdditionalInformation: true, additionalInformationFields: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
    });
}

async function listPatientRegistrationSchemes() {
    return prisma.patientScheme.findMany({
        where: { status: "ACTIVE" },
        select: {
            id: true,
            code: true,
            name: true,
            eligibilityGender: true,
            ageCriteriaType: true,
            ageLimit: true,
            minimumAge: true,
            maximumAge: true,
            collectAdditionalInformation: true,
            additionalInformationFields: true,
        },
        orderBy: { name: "asc" },
    });
}

async function getBillablePatient(patientId, serviceIds) {
    const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
            scheme: true,
        },
    });
    if (!patient || patient.status !== "ACTIVE" || patient.archivedAt) {
        throw fail("BILLING_PATIENT_NOT_FOUND", "Active registered patient not found");
    }
    let scheme = patient.scheme;
    if (scheme) {
        if (scheme.status !== "ACTIVE") throw fail("BILLING_SCHEME_INACTIVE", "The patient's assigned scheme is inactive");
        validateSchemeEligibility(scheme, patient.gender, calculateAge(patient.dateOfBirth, patient.age), "BILLING_SCHEME_INELIGIBLE");
    }
    const services = await prisma.billingService.findMany({
        where: { id: { in: serviceIds }, isActive: true },
        include: { tariffs: { where: { endedAt: null } } },
    });
    if (services.length !== serviceIds.length) throw fail("BILLING_SERVICE_NOT_FOUND", "One or more selected services are invalid or inactive");
    return { patient, scheme, services };
}

function calculateBill(category, inputItems, services, scheme) {
    const serviceById = new Map(services.map((service) => [service.id, service]));
    const lines = inputItems.map((input) => {
        const service = serviceById.get(input.serviceId);
        const tariff = serviceData(service, category);
        const unitPrice = cents(tariff.amount);
        const gross = unitPrice * input.quantity;
        if (gross > 9999999999) throw fail("BILLING_INVALID_AMOUNT", `${service.name} total exceeds the supported limit`);
        const globalEligible = Boolean(scheme);
        return {
            service,
            tariff,
            quantity: input.quantity,
            unitPrice,
            gross,
            globalEligible,
            eligibleBase: globalEligible ? gross : 0,
            schemeDiscount: 0,
        };
    });

    const eligibleSubtotal = lines.reduce((sum, line) => sum + line.eligibleBase, 0);
    if (scheme) {
        proportionalDiscount(lines.filter((line) => line.globalEligible), eligibleSubtotal);
    }
    const gross = lines.reduce((sum, line) => sum + line.gross, 0);
    const discount = lines.reduce((sum, line) => sum + line.schemeDiscount, 0);
    if (gross > 9999999999 || discount > gross) throw fail("BILLING_INVALID_AMOUNT", "Bill total exceeds the supported limit");
    const net = gross - discount;
    const items = lines.map((line) => ({
        serviceId: line.service.id,
        tariffId: line.tariff.id,
        serviceNameSnapshot: line.service.name,
        quantity: line.quantity,
        tariffUnitPrice: amount(line.unitPrice),
        grossAmount: amount(line.gross),
        discountAmount: amount(line.schemeDiscount),
        netAmount: amount(line.gross - line.schemeDiscount),
        discountSnapshot: {
            schemeDiscount: amount(line.schemeDiscount),
            schemeCode: scheme?.code || null,
            schemeName: scheme?.name || null,
            schemeDiscountType: line.globalEligible ? "PERCENTAGE" : "NONE",
            schemeDiscountValue: line.globalEligible ? 100 : 0,
        },
    }));
    return {
        gross,
        discount,
        net,
        items,
        schemeSnapshot: scheme ? {
            id: scheme.id,
            code: scheme.code,
            name: scheme.name,
            discountType: "PERCENTAGE",
            discountValue: 100,
            eligibility: getSchemeEligibilitySnapshot(scheme),
        } : null,
    };
}

async function quoteBill(input) {
    const data = billQuoteSchema.parse(input);
    if (new Set(data.items.map((item) => item.serviceId)).size !== data.items.length) {
        throw fail("BILLING_INVALID_ITEMS", "Add each service once and set its quantity");
    }
    const { patient, scheme, services } = await getBillablePatient(
        data.patientId,
        data.items.map((item) => item.serviceId)
    );
    const calculated = calculateBill(data.category, data.items, services, scheme);
    return {
        patient: {
            id: patient.id,
            uhid: patient.uhid,
            fullName: patient.firstName,
            scheme: scheme ? { code: scheme.code, name: scheme.name } : null,
        },
        category: data.category,
        grossAmount: amount(calculated.gross),
        discountAmount: amount(calculated.discount),
        netPayable: amount(calculated.net),
        items: calculated.items,
        schemeSnapshot: calculated.schemeSnapshot,
    };
}

function makeBillNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `BILL-${date}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function readBill(where) {
    const bill = await prisma.bill.findUnique({
        where,
        include: {
            patient: { select: { id: true, uhid: true, firstName: true, age: true, gender: true, phone: true } },
            createdByUser: { select: { id: true, employeeId: true, fullName: true } },
            items: { orderBy: { id: "asc" } },
            payments: {
                include: {
                    handledByUser: { select: { id: true, employeeId: true, fullName: true } },
                    reversedByUser: { select: { id: true, employeeId: true, fullName: true } },
                },
                orderBy: { confirmedAt: "asc" },
            },
        },
    });
    if (!bill) throw fail("BILLING_BILL_NOT_FOUND", "Bill not found");
    const collected = paymentTotal(bill.payments);
    return {
        ...bill,
        payments: bill.payments.map((payment) => ({
            ...payment,
            method: normalizePaymentMethod(payment.method),
        })),
        amountCollected: amount(collected),
        outstandingAmount: amount(Math.max(0, cents(bill.netPayable) - collected)),
    };
}

async function createBill(input, actorId) {
    const data = billInputSchema.parse(input);
    if (new Set(data.items.map((item) => item.serviceId)).size !== data.items.length) {
        throw fail("BILLING_INVALID_ITEMS", "Add each service once and set its quantity");
    }
    const existing = await prisma.bill.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: { items: true, payments: true },
    });
    if (existing) {
        assertBillRequestMatches(existing, data);
        return readBill({ id: existing.id });
    }

    const serviceIds = data.items.map((item) => item.serviceId);
    const { patient, scheme, services } = await getBillablePatient(data.patientId, serviceIds);
    const calculated = calculateBill(data.category, data.items, services, scheme);
    const adjustment = applyMiscellaneousAmount(calculated.net, data.miscellaneousAmount);
    const normalizedRequestMethod = normalizePaymentMethod(data.paymentMethod || null);
    const initialPayment = initialPaymentForBill(
        adjustment.net,
        normalizedRequestMethod,
        Boolean(data.posConfirmed ?? data.gpayConfirmed)
    );

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const createdId = await prisma.$transaction(async (tx) => {
                const bill = await tx.bill.create({
                    data: {
                        billNumber: makeBillNumber(),
                        idempotencyKey: data.idempotencyKey,
                        patientId: patient.id,
                        createdBy: actorId,
                        schemeId: scheme?.id,
                        category: data.category,
                        grossAmount: amount(calculated.gross),
                        discountAmount: amount(calculated.discount),
                        miscellaneousAmount: adjustment.amount === null ? null : amount(adjustment.amount),
                        miscellaneousDiscountAmount: amount(adjustment.discount),
                        adjustmentType: adjustment.amount === null ? null : "MISCELLANEOUS",
                        netPayable: amount(adjustment.net),
                        remarks: data.remarks || null,
                        schemeSnapshot: calculated.schemeSnapshot,
                        status: initialPayment ? "PAID" : "WAIVED",
                        items: { create: calculated.items },
                        ...(initialPayment ? {
                            payments: {
                                create: {
                                    handledBy: actorId,
                                    method: initialPayment.method,
                                    amount: initialPayment.amount,
                                    idempotencyKey: `${data.idempotencyKey}:payment`,
                                },
                            },
                        } : {}),
                    },
                });
                await addAudit(tx, actorId, "BILL_CREATED", "BILL", bill.id, {
                    billNumber: bill.billNumber,
                    patientId: patient.id,
                    gross: amount(calculated.gross),
                    schemeDiscount: amount(calculated.discount),
                    miscellaneousAmount: adjustment.amount === null ? null : amount(adjustment.amount),
                    miscellaneousDiscount: amount(adjustment.discount),
                    adjustmentType: adjustment.amount === null ? null : "MISCELLANEOUS",
                    payable: amount(adjustment.net),
                    category: data.category,
                });
                if (adjustment.amount !== null) {
                    await addAudit(tx, actorId, "MISCELLANEOUS_ADJUSTMENT_APPLIED", "BILL", bill.id, {
                        billNumber: bill.billNumber,
                        patientId: patient.id,
                        originalBillAmount: amount(calculated.gross),
                        schemeDiscountAmount: amount(calculated.discount),
                        miscellaneousAmount: amount(adjustment.amount),
                        miscellaneousDiscountAmount: amount(adjustment.discount),
                        finalPayableAmount: amount(adjustment.net),
                    });
                }
                return bill.id;
            }, { isolationLevel: "Serializable" });
            return readBill({ id: createdId });
        } catch (error) {
            if (error.code === "P2002") {
                const duplicate = await prisma.bill.findUnique({
                    where: { idempotencyKey: data.idempotencyKey },
                    include: { items: true, payments: true },
                });
                if (duplicate) {
                    assertBillRequestMatches(duplicate, data);
                    return readBill({ id: duplicate.id });
                }
                if (attempt < 2) continue;
            }
            if (error.code === "P2034" && attempt < 2) continue;
            throw error;
        }
    }
    throw fail("BILLING_TRANSACTION_FAILED", "Bill could not be saved; please retry");
}

async function reversePayment(paymentId, actorId, reason) {
    const id = Number(paymentId);
    const parsedReason = z.string().trim().min(3).max(500).parse(reason);
    if (!Number.isInteger(id) || id < 1) throw fail("BILLING_INVALID_PAYMENT", "Invalid payment id");
    const billNumber = await prisma.$transaction(async (tx) => {
        const payment = await tx.billPayment.findUnique({ where: { id }, include: { bill: { include: { payments: true } } } });
        if (!payment) throw fail("BILLING_PAYMENT_NOT_FOUND", "Payment not found");
        if (payment.status !== "CONFIRMED") throw fail("BILLING_PAYMENT_REVERSED", "Payment has already been reversed");
        await tx.billPayment.update({
            where: { id },
            data: { status: "REVERSED", reversedAt: new Date(), reversedBy: actorId, reversalReason: parsedReason },
        });
        const collected = paymentTotal(payment.bill.payments) - cents(payment.amount);
        await tx.bill.update({
            where: { id: payment.billId },
            data: { status: applyBillStatus(cents(payment.bill.netPayable), collected) },
        });
        await addAudit(tx, actorId, "PAYMENT_REVERSED", "PAYMENT", id, {
            billNumber: payment.bill.billNumber, amount: amount(cents(payment.amount)), reason: parsedReason,
        });
        return payment.bill.billNumber;
    }, { isolationLevel: "Serializable" });
    return readBill({ billNumber });
}

function normalizePaymentMethod(method) {
    return method === "GPAY" ? "POS" : method;
}

function parseReportFilters(query, role, userId) {
    const range = buildReportRange(query);
    const method = query.method ? String(query.method).toUpperCase() : "";
    if (method && !["CASH", "GPAY", "POS"].includes(method)) {
        throw fail("BILLING_REPORT_VALIDATION_ERROR", "Payment method must be Cash or POS");
    }
    let staffId = null;
    if (role === "ADMIN" && query.staffId) {
        staffId = Number(query.staffId);
        if (!Number.isInteger(staffId) || staffId < 1) throw fail("BILLING_REPORT_VALIDATION_ERROR", "Invalid staff selection");
    } else if (role !== "ADMIN") {
        staffId = userId;
    }
    return { ...range, method: method ? normalizePaymentMethod(method) : null, staffId };
}

async function getReport(query, role, userId) {
    role = String(role).toUpperCase();
    const filters = parseReportFilters(query, role, userId);
    const billWhere = {
        createdAt: { gte: filters.start, lte: filters.end },
        ...(filters.staffId ? { createdBy: filters.staffId } : {}),
    };
    const paymentMethodFilter = filters.method === "CASH"
        ? { method: "CASH" }
        : filters.method === "POS"
            ? { method: { in: ["GPAY", "POS"] } }
            : {};
    const paymentsWhere = {
        ...paymentMethodFilter,
        ...(filters.staffId ? { handledBy: filters.staffId } : {}),
        OR: [
            { confirmedAt: { gte: filters.start, lte: filters.end } },
            { status: "REVERSED", reversedAt: { gte: filters.start, lte: filters.end } },
        ],
    };
    const [bills, payments] = await Promise.all([
        prisma.bill.findMany({
            where: billWhere,
            include: {
                items: true,
                patient: { select: { uhid: true, firstName: true } },
                payments: { select: { amount: true, status: true } },
                createdByUser: { select: { id: true, employeeId: true, fullName: true } },
            },
            orderBy: { createdAt: "asc" },
        }),
        prisma.billPayment.findMany({
            where: paymentsWhere,
            select: {
                amount: true, method: true, status: true, handledBy: true, confirmedAt: true, reversedAt: true,
                handledByUser: { select: { fullName: true, employeeId: true } },
            },
        }),
    ]);
    const serviceRows = new Map();
    const schemeRows = new Map();
    let gross = 0;
    let discounts = 0;
    let miscellaneousDiscounts = 0;
    let payable = 0;
    let outstanding = 0;
    const staffRows = new Map();
    for (const bill of bills) {
        gross += cents(bill.grossAmount);
        discounts += cents(bill.discountAmount) + cents(bill.miscellaneousDiscountAmount || 0);
        miscellaneousDiscounts += cents(bill.miscellaneousDiscountAmount || 0);
        payable += cents(bill.netPayable);
        outstanding += Math.max(0, cents(bill.netPayable) - paymentTotal(bill.payments));
        const staff = staffRows.get(bill.createdBy) || {
            staffId: bill.createdBy, staffName: bill.createdByUser.fullName,
            employeeId: bill.createdByUser.employeeId, billCount: 0,
            grossAmount: 0, discountAmount: 0, netPayable: 0,
            miscellaneousDiscountAmount: 0, amountCollected: 0, outstandingAmount: 0,
        };
        staff.billCount += 1;
        staff.grossAmount += cents(bill.grossAmount);
        staff.discountAmount += cents(bill.discountAmount) + cents(bill.miscellaneousDiscountAmount || 0);
        staff.miscellaneousDiscountAmount += cents(bill.miscellaneousDiscountAmount || 0);
        staff.netPayable += cents(bill.netPayable);
        staff.amountCollected += paymentTotal(bill.payments);
        staff.outstandingAmount += Math.max(0, cents(bill.netPayable) - paymentTotal(bill.payments));
        staffRows.set(bill.createdBy, staff);
        const schemeKey = bill.schemeSnapshot?.code || "NO_SCHEME";
        const schemeRow = schemeRows.get(schemeKey) || {
            code: schemeKey, name: bill.schemeSnapshot?.name || "No scheme", billCount: 0,
            grossAmount: 0, discountAmount: 0, netPayable: 0,
        };
        schemeRow.billCount += 1;
        schemeRow.grossAmount += cents(bill.grossAmount);
        schemeRow.discountAmount += cents(bill.discountAmount);
        schemeRow.netPayable += cents(bill.grossAmount) - cents(bill.discountAmount);
        schemeRows.set(schemeKey, schemeRow);
        for (const item of bill.items) {
            const row = serviceRows.get(item.serviceId) || {
                serviceId: item.serviceId, serviceName: item.serviceNameSnapshot,
                quantity: 0, grossAmount: 0, discountAmount: 0, netPayable: 0,
            };
            row.quantity += item.quantity;
            row.grossAmount += cents(item.grossAmount);
            row.discountAmount += cents(item.discountAmount);
            row.netPayable += cents(item.netAmount);
            serviceRows.set(item.serviceId, row);
        }
    }
    const collections = { CASH: { collected: 0, reversed: 0, count: 0 }, POS: { collected: 0, reversed: 0, count: 0 } };
    let paymentTransactionCount = 0;
    for (const payment of payments) {
        if (!staffRows.has(payment.handledBy)) {
            staffRows.set(payment.handledBy, {
                staffId: payment.handledBy,
                staffName: payment.handledByUser.fullName,
                employeeId: payment.handledByUser.employeeId,
                billCount: 0,
                grossAmount: 0,
                discountAmount: 0,
                netPayable: 0,
                miscellaneousDiscountAmount: 0,
                amountCollected: 0,
                outstandingAmount: 0,
            });
        }
    }
    for (const payment of payments) {
        const key = normalizePaymentMethod(payment.method);
        const events = paymentEvents(payment, filters.start, filters.end);
        paymentTransactionCount += paymentEventCount(payment, filters.start, filters.end);
        if (events.collected) {
            collections[key].collected += cents(payment.amount);
            collections[key].count += 1;
        }
        if (events.reversed) {
            collections[key].reversed += cents(payment.amount);
            collections[key].count += 1;
        }
    }
    const cashAmount = collections.CASH.collected - collections.CASH.reversed;
    const posAmount = collections.POS.collected - collections.POS.reversed;
    const amountCollected = cashAmount + posAmount;
    for (const [staffId, row] of staffRows) {
        const staffPayments = payments.filter((payment) => payment.handledBy === staffId);
        row.paymentTransactionCount = 0;
        row.amountCollected = 0;
        for (const payment of staffPayments) {
            const events = paymentEvents(payment, filters.start, filters.end);
            if (events.collected) {
                row.paymentTransactionCount += 1;
                row.amountCollected += cents(payment.amount);
            }
            if (events.reversed) {
                row.paymentTransactionCount += 1;
                row.amountCollected -= cents(payment.amount);
            }
        }
        for (const key of ["grossAmount", "discountAmount", "miscellaneousDiscountAmount", "netPayable", "amountCollected", "outstandingAmount"]) row[key] = amount(row[key]);
        staffRows.set(staffId, row);
    }
    let staffSummary = [...staffRows.values()];
    if (role === "ADMIN" && !filters.staffId) {
        const billingUsers = await prisma.user.findMany({
            where: { status: "ACTIVE", userRoles: { some: { role: { name: "BILLING" } } } },
            select: { id: true, employeeId: true, fullName: true },
            orderBy: { fullName: "asc" },
        });
        const known = new Set(staffSummary.map((row) => row.staffId));
        staffSummary = [
            ...staffSummary,
            ...billingUsers.filter((staff) => !known.has(staff.id)).map((staff) => ({
                staffId: staff.id, staffName: staff.fullName, employeeId: staff.employeeId,
                billCount: 0, grossAmount: "0.00", discountAmount: "0.00",
                miscellaneousDiscountAmount: "0.00", netPayable: "0.00",
                amountCollected: "0.00", outstandingAmount: "0.00", paymentTransactionCount: 0,
            })),
        ];
    }
    const grandTotal = discounts + amountCollected;
    const financialSummary = {
        grandTotal: amount(grandTotal),
        discountAmount: amount(discounts),
        totalCollected: amount(amountCollected),
        cashAmount: amount(cashAmount),
        posAmount: amount(posAmount),
    };

    return {
        period: filters.period,
        from: filters.start.toISOString(),
        to: filters.end.toISOString(),
        staffId: filters.staffId,
        paymentMethod: filters.method,
        transactionCount: bills.length,
        paymentTransactionCount,
        bills: bills.map((bill) => {
            const collected = paymentTotal(bill.payments);
            return {
                billNumber: bill.billNumber,
                createdAt: bill.createdAt,
                patientName: bill.patient.firstName,
                uhid: bill.patient.uhid,
                category: bill.category,
                remarks: bill.remarks,
                originalBillAmount: bill.grossAmount,
                schemeDiscountAmount: bill.discountAmount,
                miscellaneousAmount: bill.miscellaneousAmount,
                miscellaneousDiscountAmount: bill.miscellaneousDiscountAmount,
                adjustmentType: bill.adjustmentType,
                adjustmentAppliedBy: bill.adjustmentType === "MISCELLANEOUS" ? bill.createdByUser.fullName : null,
                netPayable: bill.netPayable,
                amountCollected: amount(collected),
                outstandingAmount: amount(Math.max(0, cents(bill.netPayable) - collected)),
                status: bill.status,
            };
        }),
        financialSummary,
        grossServiceCharges: amount(gross),
        totalDiscounts: amount(discounts),
        miscellaneousDiscounts: amount(miscellaneousDiscounts),
        netPayable: amount(payable),
        amountCollected: amount(amountCollected),
        outstandingBalance: amount(outstanding),
        reversals: amount(collections.CASH.reversed + collections.POS.reversed),
        collections: {
            CASH: { grossCollected: amount(collections.CASH.collected), reversed: amount(collections.CASH.reversed), netCollected: amount(collections.CASH.collected - collections.CASH.reversed), transactionCount: collections.CASH.count },
            POS: { grossCollected: amount(collections.POS.collected), reversed: amount(collections.POS.reversed), netCollected: amount(collections.POS.collected - collections.POS.reversed), transactionCount: collections.POS.count },
        },
        services: [...serviceRows.values()].map((row) => ({
            ...row, grossAmount: amount(row.grossAmount), discountAmount: amount(row.discountAmount), netPayable: amount(row.netPayable),
        })),
        schemes: [...schemeRows.values()].map((row) => ({
            ...row, grossAmount: amount(row.grossAmount), discountAmount: amount(row.discountAmount), netPayable: amount(row.netPayable),
        })),
        staff: staffSummary,
    };
}

async function listBillingStaff() {
    return prisma.user.findMany({
        where: { userRoles: { some: { role: { name: "BILLING" } } } },
        select: { id: true, employeeId: true, fullName: true, status: true },
        orderBy: { fullName: "asc" },
    });
}

module.exports = {
    createBill,
    createService,
    getReport,
    listBillingStaff,
    listPatientRegistrationSchemes,
    listServices,
    localDateString,
    quoteBill,
    readBill,
    reversePayment,
    searchBillingPatients,
    updateService,
    calculateBill,
    applyMiscellaneousAmount,
    assertBillRequestMatches,
    initialPaymentForBill,
    paymentEvents,
    paymentEventCount,
    billInputSchema,
};
