const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { prisma } = require("../../config/prisma");

const MAX_FAILED_ATTEMPTS = 5;

async function loginUser(username, password) {

    // find user by username
    const user = await prisma.user.findUnique({
        where: {
            username,
        },
        include: {
            role: true,
        },
    });

    // user does not exist
    if(!user){
        throw new Error("Invalid Username or Password");
    }

    // check locked status
    if(user.status === "LOCKED"){
        throw new Error("Your account is locked. Please contact the administrator.");
    }

    // check inactive status
    if(user.status === "INACTIVE"){
        throw new Error("Your account is inactive. Please contact the administrator.");
    }


    // compare entered password with hashed password
    const passwordMatch = await bcrypt.compare(password,user.password);

    if(!passwordMatch){
        const newFailedAttempts = user.failedAttempts + 1;

        if(newFailedAttempts >= MAX_FAILED_ATTEMPTS){
            await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    failedAttempts: newFailedAttempts,
                    status: "LOCKED",
                },
            });
            throw new Error("Too many failed login attempts. Your account has been locked. Please contact the administrator.");
        }

        // just increment failed attempts
        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                failedAttempts: newFailedAttempts,
            },
        });

        const remainingAttempts = MAX_FAILED_ATTEMPTS - newFailedAttempts;
        throw new Error(`Invalid Username or Password. ${remainingAttempts} login attempts remaining.`);
    }
    
    // Successful login
    // create JWT
    const token = jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: user.role.name
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



