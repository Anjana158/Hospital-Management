function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        let userRole;

        if(req.user.role && typeof req.user.role === "object"){
            userRole = req.user.role.name;
        }else{
            userRole = req.user.role;
        }

        if (!userRole) {
            return res.status(403).json({
                success: false,
                message: "User role not found",
            });
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin permission required.",
            });
        }

        const normalizedUserRole = userRole.toUpperCase();
        const normalizedAllowedRoles = allowedRoles.map(role => role.toUpperCase());

        if(!normalizedAllowedRoles.includes(normalizedUserRole)){
            return res.status(403).json({
                success: false,
                message: "Access denied.",
            });
        }

        next();
    };
}

module.exports = {
    requireRole,
};