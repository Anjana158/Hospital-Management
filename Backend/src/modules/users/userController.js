const { getAllUsers,getAllRoles,createUser,updateUser,changeUserStatus,} = require("./userService");


// ========================================
// GET USERS
// ========================================

async function getUsers(req, res) {
    try {
        const { roleId } = req.query;

        const users = await getAllUsers(roleId);

        return res.status(200).json({
            success: true,
            data: users,
        });

    } catch (error) {
        console.error("Get users error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
        });
    }
}


// ========================================
// GET ROLES
// ========================================

async function getRoles(req, res) {
    try {
        const roles = await getAllRoles();

        return res.status(200).json({
            success: true,
            data: roles,
        });

    } catch (error) {
        console.error("Get roles error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch roles",
        });
    }
}


// ========================================
// CREATE USER
// ========================================

async function addUser(req, res) {
    try {
        const {
            employeeId,
            fullName,
            username,
            password,
            roleId,
            status,
        } = req.body;


        if (
            !employeeId ||
            !fullName ||
            !username ||
            !password ||
            !roleId
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Employee ID, Full Name, Username, Password and Role are required",
            });
        }


        const user = await createUser(
            req.body,
            req.user.userId
        );


        return res.status(201).json({
            success: true,
            message: "User created successfully",
            data: user,
        });

    } catch (error) {
        console.error("Create user error:", error);

        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}


// ========================================
// UPDATE USER
// ========================================

async function editUser(req, res) {
    try {
        const { id } = req.params;

        const user = await updateUser(
            id,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user,
        });

    } catch (error) {
        console.error("Update user error:", error);

        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }
}


// ===============================updateData=========
// CHANGE USER STATUS
// ========================================

async function updateUserStatus(req,res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({
                success: false,
                message:"Status is required",
            });
        }


        const user =
            await changeUserStatus(

                id,

                status,

                req.user.userId

            );


        return res.status(200).json({

            success: true,

            message:
                "User status updated successfully",

            data: user,

        });

    } catch (error) {

        console.error(
            "Status update error:",
            error
        );

        return res.status(400).json({

            success: false,

            message: error.message,

        });
    }
}


module.exports = {
    getUsers,
    getRoles,
    addUser,
    editUser,
    updateUserStatus,
};