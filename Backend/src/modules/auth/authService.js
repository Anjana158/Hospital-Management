const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { prisma } = require("../../config/prisma");

async function loginUser(username, password) {
    // find user by username
    const user = await prisma.user.findUnique({
        where: {
            username: username,
        },
        include: {
            role: true,
        },
    });

    // user does not exist
    if(!user){
        throw new Error("Invalid Username or Password");
    }

    // check account status
    if(user.status !== "ACTIVE"){
        throw new Error("User account is not active");
    }

    // compare entered password with hashed password
    const passwordMatch = await bcrypt.compare(password,user.password);

    if(!passwordMatch){
        throw new Error("Invalid U;sername or Password")
    }

    const token = jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: user.role
        },
        process.env.JWT_SECRET,{
            expiresIn:"1h",
        }
    );

    // update last login
    await prisma.user.update({
        where:{
            id:user.id,
        },
        data:{
            lastLogin:new Date(),
            failedAttempts:0,
        },
    });

    return{
        token,
        user: {
            id: user.id,
            employeeId: user.employeeId,
            fullName: user.fullName,
            username:user.username,
            role: user.role,
            status: user.status,
        },
    };
}

module.exports = {
    loginUser,
};