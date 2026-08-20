const { success } = require("zod");
const { loginUser } = require("../auth/authService");

async function login(req,res) {
    try{
        const { username, password } = req.body;

        // check required fields
        if(!username || !password){
            return res.status(400).json({
                success: false,
                message: "Username and Password are required",
            });
        }

        const result = await loginUser(username, password);
        return res.status(200).json({
            success:true,
            message:"Login successful",
            data:result,
        });
    } catch(error){
        console.log("Login error:",error);

        return res.status(401).json({
            success: false,
            message: error.message,
        });
    }
}

function getCurrentUser(req,res){
    return res.status(200).json({
        success:true,
        message: "Aithentication successful",
        user: req.user,
    });
}

module.exports = { login,getCurrentUser, };