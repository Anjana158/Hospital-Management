const jwt = require("jsonwebtoken");

function authenticateToken(req,res,next){
    try{
        // get authorization header
        const authHeader = req.headers.authorization;

        if(!authHeader){
            return res.status(401).json({
                success: false,
                message: "Authorization token is required",
            });
        }

        // authorization: bearer Token
        const parts = authHeader.split(" ")

        if(parts.length !== 2 || parts[0] !== "Bearer"){
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format",
            });
        }

        const token = parts[1];

        // verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // store decoded user information in request
        req.user = decoded;
        // continue to the next middleware
        next();
    }catch(error){
        console.log("Authentication error:",error.message);
        return res.status(401).json({
            success:false,
            message: "Invalid or expired token",
        });
    }
}

module.exports = {authenticateToken,};