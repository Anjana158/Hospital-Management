const {
    loginUser,
    getRolesForUsername,
    refreshSession,
    revokeRefreshToken,
} = require("../auth/authService");

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function refreshCookieOptions(req) {
    return {
        httpOnly: true,
        secure: Boolean(req.secure || req.headers["x-forwarded-proto"] === "https"),
        sameSite: "lax",
        path: "/api/auth",
    };
}

function setRefreshCookie(req, res, refreshToken) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
        ...refreshCookieOptions(req),
        maxAge: REFRESH_COOKIE_MAX_AGE,
    });
}

function clearRefreshCookie(req, res) {
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(req));
}

async function getAssignedRoles(req, res) {
    try {
        const username = String(req.query.username || "").trim();

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Username is required",
            });
        }

        const roles = await getRolesForUsername(username);

        return res.status(200).json({
            success: true,
            data: roles,
        });
    } catch (error) {
        console.error("Get assigned roles error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch roles",
        });
    }
}

async function login(req, res) {
    try {
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and Password are required",
            });
        }

        const result = await loginUser(
            String(username).trim(),
            password,
            role
        );
        const { refreshToken, ...session } = result;
        setRefreshCookie(req, res, refreshToken);

        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: session,
        });
    } catch (error) {
        console.log("Login error:", error);

        return res.status(401).json({
            success: false,
            message: error.message,
        });
    }
}

async function refresh(req, res) {
    try {
        const result = await refreshSession(req.cookies?.[REFRESH_COOKIE]);
        const { refreshToken, ...session } = result;
        setRefreshCookie(req, res, refreshToken);

        return res.status(200).json({
            success: true,
            message: "Access token refreshed",
            data: session,
        });
    } catch (error) {
        clearRefreshCookie(req, res);
        console.log("Refresh error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Session expired. Please log in again.",
        });
    }
}

async function logout(req, res) {
    try {
        await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    } catch (error) {
        console.log("Logout error:", error.message);
    }

    clearRefreshCookie(req, res);

    return res.status(200).json({
        success: true,
        message: "Logged out",
    });
}

function getCurrentUser(req, res) {
    return res.status(200).json({
        success: true,
        message: "Aithentication successful",
        user: req.user,
    });
}

module.exports = {
    login,
    getAssignedRoles,
    refresh,
    logout,
    getCurrentUser,
};
